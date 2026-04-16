import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import { HistoryEntry, Bookmark, UrlSuggestion, SessionTab, Space, CONFIG } from '../types';

/**
 * AppDatabase — SQLite with WAL mode, prepared statements, indexed columns.
 *
 * Tables: history, bookmarks, session
 */
export class AppDatabase {
  private readonly db: Database.Database;

  // Cached prepared statements
  private readonly stmtInsertHistory: Database.Statement;
  private readonly stmtUpdateHistory: Database.Statement;
  private readonly stmtSearchHistory: Database.Statement;
  private readonly stmtInsertBookmark: Database.Statement;
  private readonly stmtDeleteBookmark: Database.Statement;
  private readonly stmtGetBookmarks: Database.Statement;
  private readonly stmtIsBookmarked: Database.Statement;
  private readonly stmtSearchSuggestions: Database.Statement;
  private readonly stmtFindHistory: Database.Statement; // Cached for recordVisit
  private readonly stmtSaveSession: Database.Statement;
  private readonly stmtClearSession: Database.Statement;
  private readonly stmtGetSession: Database.Statement;
  private readonly stmtGetFullHistory: Database.Statement;
  private readonly stmtClearHistory: Database.Statement;

  // Workspace statements
  private readonly stmtInsertSpace: Database.Statement;
  private readonly stmtUpdateSpaceName: Database.Statement;
  private readonly stmtUpdateSpaceColor: Database.Statement;
  private readonly stmtUpdateSpacePosition: Database.Statement;
  private readonly stmtDeleteSpace: Database.Statement;
  private readonly stmtGetSpaces: Database.Statement;
  private readonly stmtGetSpace: Database.Statement;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'astra.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();

    this.stmtInsertHistory = this.db.prepare(
      `INSERT INTO history (url, title, visit_count, last_visited_at) VALUES (?, ?, 1, ?)`,
    );

    this.stmtUpdateHistory = this.db.prepare(
      `UPDATE history SET title = ?, visit_count = visit_count + 1, last_visited_at = ? WHERE url = ?`,
    );

    this.stmtSearchHistory = this.db.prepare(
      `SELECT * FROM history WHERE url LIKE ? OR title LIKE ? ORDER BY visit_count DESC, last_visited_at DESC LIMIT ?`,
    );

    this.stmtInsertBookmark = this.db.prepare(
      `INSERT OR IGNORE INTO bookmarks (url, title, created_at) VALUES (?, ?, ?)`,
    );

    this.stmtDeleteBookmark = this.db.prepare(`DELETE FROM bookmarks WHERE url = ?`);
    this.stmtGetBookmarks = this.db.prepare(`SELECT * FROM bookmarks ORDER BY created_at DESC`);
    this.stmtIsBookmarked = this.db.prepare(`SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1`);

    this.stmtSearchSuggestions = this.db.prepare(`
      SELECT url, title, 'history' as type FROM history WHERE url LIKE ? OR title LIKE ?
      UNION
      SELECT url, title, 'bookmark' as type FROM bookmarks WHERE url LIKE ? OR title LIKE ?
      ORDER BY type ASC LIMIT ?
    `);

    this.stmtFindHistory = this.db.prepare('SELECT id FROM history WHERE url = ?');

    this.stmtSaveSession = this.db.prepare(
      `INSERT INTO session (url, title, is_pinned, position, space_id) VALUES (?, ?, ?, ?, ?)`,
    );

    this.stmtClearSession = this.db.prepare(`DELETE FROM session`);
    this.stmtGetSession = this.db.prepare(`SELECT * FROM session ORDER BY position ASC`);
    this.stmtGetFullHistory = this.db.prepare(`SELECT * FROM history ORDER BY last_visited_at DESC LIMIT 200`);
    this.stmtClearHistory = this.db.prepare(`DELETE FROM history`);

    // Workspace statements
    this.stmtInsertSpace = this.db.prepare(
      `INSERT INTO spaces (id, name, color, icon, position, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    this.stmtUpdateSpaceName = this.db.prepare(`UPDATE spaces SET name = ? WHERE id = ?`);
    this.stmtUpdateSpaceColor = this.db.prepare(`UPDATE spaces SET color = ? WHERE id = ?`);
    this.stmtUpdateSpacePosition = this.db.prepare(`UPDATE spaces SET position = ? WHERE id = ?`);
    this.stmtDeleteSpace = this.db.prepare(`DELETE FROM spaces WHERE id = ?`);
    this.stmtGetSpaces = this.db.prepare(`SELECT * FROM spaces ORDER BY position ASC`);
    this.stmtGetSpace = this.db.prepare(`SELECT * FROM spaces WHERE id = ?`);

    console.log('[Astra] 💾 Database initialized:', dbPath);
  }

  // History
  recordVisit(url: string, title: string): void {
    if (url.startsWith('astra://') || url.startsWith('data:')) return;
    const existing = this.stmtFindHistory.get(url);
    const now = Date.now();
    if (existing) {
      this.stmtUpdateHistory.run(title, now, url);
    } else {
      this.stmtInsertHistory.run(url, title, now);
    }
  }

  searchHistory(query: string, limit = 10): HistoryEntry[] {
    const p = `%${query}%`;
    return this.stmtSearchHistory.all(p, p, limit) as HistoryEntry[];
  }

  getFullHistory(): HistoryEntry[] {
    return this.stmtGetFullHistory.all() as HistoryEntry[];
  }

  clearHistory(): void {
    this.stmtClearHistory.run();
  }

  // Bookmarks
  addBookmark(url: string, title: string): void {
    this.stmtInsertBookmark.run(url, title, Date.now());
  }

  removeBookmark(url: string): void {
    this.stmtDeleteBookmark.run(url);
  }

  getBookmarks(): Bookmark[] {
    return this.stmtGetBookmarks.all() as Bookmark[];
  }

  isBookmarked(url: string): boolean {
    return !!this.stmtIsBookmarked.get(url);
  }

  // Suggestions
  getSuggestions(query: string): UrlSuggestion[] {
    if (query.length < 2) return [];
    const p = `%${query}%`;
    return this.stmtSearchSuggestions.all(p, p, p, p, CONFIG.MAX_SUGGESTIONS) as UrlSuggestion[];
  }

  // Session restore
  saveSession(tabs: SessionTab[]): void {
    const saveAll = this.db.transaction((sessionTabs: SessionTab[]) => {
      this.stmtClearSession.run();
      for (const tab of sessionTabs) {
        this.stmtSaveSession.run(tab.url, tab.title, tab.isPinned ? 1 : 0, tab.position, tab.spaceId);
      }
    });
    saveAll(tabs);
  }

  restoreSession(): SessionTab[] {
    const rows = this.stmtGetSession.all() as any[];
    return rows.map(r => ({
      url: r.url,
      title: r.title,
      isPinned: !!r.is_pinned,
      position: r.position,
      spaceId: r.space_id || '',
    }));
  }

  // --------------------------------------------------
  // Workspaces (inspired by Zen Browser's Spaces)
  // --------------------------------------------------

  createSpace(space: Space): void {
    this.stmtInsertSpace.run(space.id, space.name, space.color, space.icon, space.position, space.createdAt);
  }

  renameSpace(id: string, name: string): void {
    this.stmtUpdateSpaceName.run(name, id);
  }

  updateSpaceColor(id: string, color: string): void {
    this.stmtUpdateSpaceColor.run(color, id);
  }

  updateSpacePosition(id: string, position: number): void {
    this.stmtUpdateSpacePosition.run(position, id);
  }

  deleteSpace(id: string): void {
    this.stmtDeleteSpace.run(id);
  }

  getSpaces(): Space[] {
    return this.stmtGetSpaces.all() as Space[];
  }

  getSpace(id: string): Space | undefined {
    return this.stmtGetSpace.get(id) as Space | undefined;
  }

  // Schema
  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT DEFAULT '',
        visit_count INTEGER DEFAULT 1,
        last_visited_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS bookmarks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT DEFAULT '',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL,
        title TEXT DEFAULT '',
        is_pinned INTEGER DEFAULT 0,
        position INTEGER DEFAULT 0,
        space_id TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS spaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6366f1',
        icon TEXT DEFAULT '🌐',
        position INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
      CREATE INDEX IF NOT EXISTS idx_history_title ON history(title);
      CREATE INDEX IF NOT EXISTS idx_history_visited ON history(last_visited_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
      CREATE INDEX IF NOT EXISTS idx_spaces_position ON spaces(position ASC);
    `);

    // Migration: add space_id to session if missing
    try {
      this.db.prepare(`SELECT space_id FROM session LIMIT 1`).get();
    } catch {
      this.db.exec(`ALTER TABLE session ADD COLUMN space_id TEXT DEFAULT ''`);
    }
  }

  close(): void {
    this.db.close();
  }
}
