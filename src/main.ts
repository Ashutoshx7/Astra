/**
 * Astra Browser — Main Process Entry Point
 *
 * Orchestrates:
 *   - AdBlocker          → Network-level ad/tracker blocking
 *   - AppDatabase        → SQLite for history + bookmarks
 *   - TabManager         → Tab lifecycle (create/switch/close)
 *   - ShortcutManager    → Keyboard shortcuts
 *   - DownloadManager    → File download tracking (via TabManager)
 *   - IPC Handlers       → Bridge between sidebar and managers
 */

import { app, BaseWindow, WebContentsView, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { TabManager } from './managers/TabManager';
import { AdBlocker } from './managers/AdBlocker';
import { ShortcutManager } from './managers/ShortcutManager';
import { AppDatabase } from './database/Database';
import { IPC, CONFIG } from './types';
import { parseUrl } from './utils/url';

require('events').defaultMaxListeners = CONFIG.MAX_LISTENERS;

if (started) {
  app.quit();
}

// --------------------------------------------------
// Window creation
// --------------------------------------------------

function createWindow(database: AppDatabase): void {
  const mainWindow = new BaseWindow({
    width: CONFIG.WINDOW.WIDTH,
    height: CONFIG.WINDOW.HEIGHT,
    minWidth: CONFIG.WINDOW.MIN_WIDTH,
    minHeight: CONFIG.WINDOW.MIN_HEIGHT,
    title: CONFIG.WINDOW.TITLE,
    backgroundColor: CONFIG.WINDOW.BG_COLOR,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: CONFIG.WINDOW.BG_COLOR,
      symbolColor: '#e0e0e0',
      height: 40,
    },
  });

  const sidebarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.contentView.addChildView(sidebarView);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    sidebarView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    sidebarView.webContents.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // --------------------------------------------------
  // Initialize managers
  // --------------------------------------------------

  const tabManager = new TabManager(mainWindow, sidebarView, database);
  const shortcutManager = new ShortcutManager(tabManager, sidebarView, database);

  // Create the first tab (new tab page)
  const firstTab = tabManager.createTab();
  tabManager.switchToTab(firstTab.id);

  shortcutManager.initialize();
  mainWindow.on('resize', () => tabManager.layout());

  // --------------------------------------------------
  // IPC Handlers
  // --------------------------------------------------

  ipcMain.on(IPC.REQUEST_TABS, () => tabManager.sendTabsToSidebar());
  ipcMain.on(IPC.NAVIGATE, (_e, url: string) => tabManager.navigateActiveTab(parseUrl(url)));
  ipcMain.on(IPC.GO_BACK, () => tabManager.goBack());
  ipcMain.on(IPC.GO_FORWARD, () => tabManager.goForward());
  ipcMain.on(IPC.REFRESH, () => tabManager.reload());

  ipcMain.on(IPC.NEW_TAB, (_e, url?: string) => {
    const tab = tabManager.createTab(url || undefined);
    tabManager.switchToTab(tab.id);
  });

  ipcMain.on(IPC.CLOSE_TAB, (_e, tabId: string) => tabManager.closeTab(tabId));
  ipcMain.on(IPC.SWITCH_TAB, (_e, tabId: string) => tabManager.switchToTab(tabId));

  // URL suggestions (debounced on the renderer side)
  ipcMain.on(IPC.SEARCH_SUGGESTIONS, (_e, query: string) => {
    const suggestions = database.getSuggestions(query);
    sidebarView.webContents.send(IPC.SUGGESTIONS_RESULT, suggestions);
  });

  // Bookmarks
  ipcMain.on(IPC.ADD_BOOKMARK, (_e, data: { url: string; title: string }) => {
    database.addBookmark(data.url, data.title);
    sidebarView.webContents.send(IPC.BOOKMARK_STATUS, true);
  });

  ipcMain.on(IPC.REMOVE_BOOKMARK, (_e, url: string) => {
    database.removeBookmark(url);
    sidebarView.webContents.send(IPC.BOOKMARK_STATUS, false);
  });

  ipcMain.on(IPC.GET_BOOKMARKS, () => {
    const bookmarks = database.getBookmarks();
    sidebarView.webContents.send(IPC.BOOKMARKS_RESULT, bookmarks);
  });

  // DevTools in dev mode only
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    sidebarView.webContents.openDevTools({ mode: 'detach' });
  }
}

// --------------------------------------------------
// App lifecycle
// --------------------------------------------------

app.on('ready', async () => {
  const adBlocker = new AdBlocker();
  await adBlocker.initialize();

  const database = new AppDatabase();
  createWindow(database);

  // Clean up on quit
  app.on('before-quit', () => database.close());
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) {
    const database = new AppDatabase();
    createWindow(database);
  }
});
