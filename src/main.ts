/**
 * Astra Browser — Main Process Entry Point
 *
 * This file orchestrates the app lifecycle:
 *   1. Initialize ad blocker
 *   2. Create the window (BaseWindow + sidebar WebContentsView)
 *   3. Start TabManager, ShortcutManager
 *   4. Register IPC handlers
 *
 * Business logic lives in:
 *   - managers/TabManager.ts    — tab lifecycle
 *   - managers/AdBlocker.ts     — ad/tracker blocking
 *   - managers/ShortcutManager.ts — keyboard shortcuts
 *   - types/index.ts            — shared interfaces
 *   - utils/url.ts              — URL parsing
 */

import { app, BaseWindow, WebContentsView, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { TabManager } from './managers/TabManager';
import { AdBlocker } from './managers/AdBlocker';
import { ShortcutManager } from './managers/ShortcutManager';
import { IPC, CONFIG } from './types';
import { parseUrl } from './utils/url';

// Prevent MaxListeners warning — each tab adds multiple event listeners
require('events').defaultMaxListeners = CONFIG.MAX_LISTENERS;

// Handle Squirrel installer events on Windows
if (started) {
  app.quit();
}

// --------------------------------------------------
// App-level singletons
// --------------------------------------------------
let tabManager: TabManager;

// --------------------------------------------------
// Window creation
// --------------------------------------------------

function createWindow(): void {
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

  // Sidebar — renders the React UI
  const sidebarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.contentView.addChildView(sidebarView);

  // Load sidebar UI
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

  tabManager = new TabManager(mainWindow, sidebarView);
  const shortcutManager = new ShortcutManager(tabManager, sidebarView);

  // Create the first tab
  const firstTab = tabManager.createTab(CONFIG.DEFAULT_URL);
  tabManager.switchToTab(firstTab.id);

  // Start listening for keyboard shortcuts
  shortcutManager.initialize();

  // Re-layout on resize (no tab switch, just reposition)
  mainWindow.on('resize', () => tabManager.layout());

  // --------------------------------------------------
  // IPC Handlers — bridge between sidebar and managers
  // --------------------------------------------------

  ipcMain.on(IPC.REQUEST_TABS, () => {
    tabManager.sendTabsToSidebar();
  });

  ipcMain.on(IPC.NAVIGATE, (_event, url: string) => {
    tabManager.navigateActiveTab(parseUrl(url));
  });

  ipcMain.on(IPC.GO_BACK, () => tabManager.goBack());
  ipcMain.on(IPC.GO_FORWARD, () => tabManager.goForward());
  ipcMain.on(IPC.REFRESH, () => tabManager.reload());

  ipcMain.on(IPC.NEW_TAB, (_event, url?: string) => {
    const newTab = tabManager.createTab(url || CONFIG.DEFAULT_URL);
    tabManager.switchToTab(newTab.id);
  });

  ipcMain.on(IPC.CLOSE_TAB, (_event, tabId: string) => {
    tabManager.closeTab(tabId);
  });

  ipcMain.on(IPC.SWITCH_TAB, (_event, tabId: string) => {
    tabManager.switchToTab(tabId);
  });

  // DevTools for debugging (remove in production)
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    sidebarView.webContents.openDevTools({ mode: 'detach' });
  }
}

// --------------------------------------------------
// App lifecycle
// --------------------------------------------------

app.on('ready', async () => {
  // Initialize ad blocker before creating any windows
  const adBlocker = new AdBlocker();
  await adBlocker.initialize();

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BaseWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
