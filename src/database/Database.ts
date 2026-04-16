import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';
import { HistoryEntry, Bookmark, UrlSuggestion, CONFIG } from '../types';

/**
 * AppDatabase — SQLite connection + schema migrations.
 *
 * Uses better-sqlite3 for synchronous operations (safe in Electron main process).
 * Database file is stored in the user's app data directory.
 *
 * Performance notes:
 *   - WAL mode for concurrent reads during writes
 *   - Prepared statements cached for repeated queries
 *   - Indexes on frequently searched columns
 */
export class AppDatabase {
  private readonly db: Database.Database;

  // Cached prepared statements (avoid re-parsing SQL on every call)
  private readonly stmtInsertHistory: Database.Statement;
  private readonly stmtUpdateHistory: Database.Statement;
  private readonly stmtSearchHistory: Database.Statement;
  private readonly stmtInsertBookmark: Database.Statement;
  private readonly stmtDeleteBookmark: Database.Statement;
  private readonly stmtGetBookmarks: Database.Statement;
  private readonly stmtIsBookmarked: Database.Statement;
  private readonly stmtSearchSuggestions: Database.Statement;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'astra.db');
    this.db = new Database(dbPath);

    // Performance: WAL mode for better concurrent read/write
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.migrate();

    // Prepare statements (cached for performance)
    this.stmtInsertHistory = this.db.prepare(`
      INSERT INTO history (url, title, visit_count, last_visited_at)
      VALUES (?, ?, 1, ?)
    `);

    this.stmtUpdateHistory = this.db.prepare(`
      UPDATE history
      SET title = ?, visit_count = visit_count + 1, last_visited_at = ?
      WHERE url = ?
    `);

    this.stmtSearchHistory = this.db.prepare(`
      SELECT * FROM history
      WHERE url LIKE ? OR title LIKE ?
      ORDER BY visit_count DESC, last_visited_at DESC
      LIMIT ?
    `);

    this.stmtInsertBookmark = this.db.prepare(`
      INSERT OR IGNORE INTO bookmarks (url, title, created_at)
      VALUES (?, ?, ?)
    `);

    this.stmtDeleteBookmark = this.db.prepare(`
      DELETE FROM bookmarks WHERE url = ?
    `);

    this.stmtGetBookmarks = this.db.prepare(`
      SELECT * FROM bookmarks ORDER BY created_at DESC
    `);

    this.stmtIsBookmarked = this.db.prepare(`
      SELECT 1 FROM bookmarks WHERE url = ? LIMIT 1
    `);

    this.stmtSearchSuggestions = this.db.prepare(`
      SELECT url, title, 'history' as type FROM history
      WHERE url LIKE ? OR title LIKE ?
      UNION
      SELECT url, title, 'bookmark' as type FROM bookmarks
      WHERE url LIKE ? OR title LIKE ?
      ORDER BY type ASC
      LIMIT ?
    `);

    console.log('[Astra] 💾 Database initialized:', dbPath);
  }

  // --------------------------------------------------
  // History
  // --------------------------------------------------

  /** Record a page visit. Updates existing entry or creates new one. */
  recordVisit(url: string, title: string): void {
    // Skip internal URLs
    if (url.startsWith('astra://') || url.startsWith('data:')) return;

    const existing = this.db.prepare('SELECT id FROM history WHERE url = ?').get(url);
    const now = Date.now();

    if (existing) {
      this.stmtUpdateHistory.run(title, now, url);
    } else {
      this.stmtInsertHistory.run(url, title, now);
    }
  }

  /** Search history by URL or title */
  searchHistory(query: string, limit = 10): HistoryEntry[] {
    const pattern = `%${query}%`;
    return this.stmtSearchHistory.all(pattern, pattern, limit) as HistoryEntry[];
  }

  // --------------------------------------------------
  // Bookmarks
  // --------------------------------------------------

  /** Add a bookmark */
  addBookmark(url: string, title: string): void {
    this.stmtInsertBookmark.run(url, title, Date.now());
  }

  /** Remove a bookmark by URL */
  removeBookmark(url: string): void {
    this.stmtDeleteBookmark.run(url);
  }

  /** Get all bookmarks */
  getBookmarks(): Bookmark[] {
    return this.stmtGetBookmarks.all() as Bookmark[];
  }

  /** Check if a URL is bookmarked */
  isBookmarked(url: string): boolean {
    return !!this.stmtIsBookmarked.get(url);
  }

  // --------------------------------------------------
  // URL Suggestions (combined history + bookmarks)
  // --------------------------------------------------

  /** Search both history and bookmarks for URL bar suggestions */
  getSuggestions(query: string): UrlSuggestion[] {
    if (query.length < 2) return [];
    const pattern = `%${query}%`;
    return this.stmtSearchSuggestions.all(
      pattern, pattern, pattern, pattern, CONFIG.MAX_SUGGESTIONS,
    ) as UrlSuggestion[];
  }

  // --------------------------------------------------
  // Schema migration
  // --------------------------------------------------

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

      CREATE INDEX IF NOT EXISTS idx_history_url ON history(url);
      CREATE INDEX IF NOT EXISTS idx_history_title ON history(title);
      CREATE INDEX IF NOT EXISTS idx_history_visited ON history(last_visited_at DESC);
      CREATE INDEX IF NOT EXISTS idx_bookmarks_url ON bookmarks(url);
    `);
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}
