/**
 * Astra Browser — Main Process Entry Point
 *
 * Orchestrates: AdBlocker, AppDatabase, TabManager, ShortcutManager
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

if (started) app.quit();

let mainWindow: BaseWindow | null = null;
let tabManager: TabManager;
let database: AppDatabase;

// --------------------------------------------------
// Window creation
// --------------------------------------------------

function createWindow(): void {
  mainWindow = new BaseWindow({
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
  // Managers
  // --------------------------------------------------

  tabManager = new TabManager(mainWindow, sidebarView, database);
  const shortcutManager = new ShortcutManager(tabManager, sidebarView, database, () => mainWindow);

  // Session restore — try to restore previous tabs, fallback to new tab
  const restored = tabManager.restoreSession();
  if (!restored) {
    const firstTab = tabManager.createTab();
    tabManager.switchToTab(firstTab.id);
  }

  shortcutManager.initialize();
  mainWindow.on('resize', () => tabManager.layout());

  // Save session before window closes
  mainWindow.on('close', () => {
    tabManager.saveSession();
  });

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

  ipcMain.on(IPC.REORDER_TABS, (_e, data: { oldIndex: number; newIndex: number }) => {
    tabManager.reorderTabs(data.oldIndex, data.newIndex);
  });

  // Pin/Unpin
  ipcMain.on(IPC.PIN_TAB, (_e, tabId: string) => tabManager.pinTab(tabId));
  ipcMain.on(IPC.UNPIN_TAB, (_e, tabId: string) => tabManager.unpinTab(tabId));

  // Find in page
  ipcMain.on(IPC.FIND_IN_PAGE, (_e, text: string) => tabManager.findInPage(text));
  ipcMain.on(IPC.FIND_STOP, () => tabManager.stopFind());

  // History
  ipcMain.on(IPC.GET_HISTORY, () => {
    sidebarView.webContents.send(IPC.HISTORY_RESULT, database.getFullHistory());
  });

  ipcMain.on(IPC.CLEAR_HISTORY, () => {
    database.clearHistory();
    sidebarView.webContents.send(IPC.HISTORY_RESULT, []);
  });

  // Suggestions
  ipcMain.on(IPC.SEARCH_SUGGESTIONS, (_e, query: string) => {
    sidebarView.webContents.send(IPC.SUGGESTIONS_RESULT, database.getSuggestions(query));
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
    sidebarView.webContents.send(IPC.BOOKMARKS_RESULT, database.getBookmarks());
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

  database = new AppDatabase();
  createWindow();

  app.on('before-quit', () => {
    tabManager?.saveSession();
    database?.close();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) createWindow();
});
