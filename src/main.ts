/**
 * Astra Browser — Main Process Entry Point
 *
 * Orchestrates: AdBlocker, AppDatabase, TabManager, ShortcutManager,
 *               SpaceManager, CompactModeManager, GlanceManager
 */

import { app, BaseWindow, WebContentsView, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { TabManager } from './managers/TabManager';
import { AdBlocker } from './managers/AdBlocker';
import { ShortcutManager } from './managers/ShortcutManager';
import { SpaceManager } from './managers/SpaceManager';
import { CompactModeManager } from './managers/CompactModeManager';
import { GlanceManager } from './managers/GlanceManager';
import { SplitViewManager } from './managers/SplitViewManager';
import { FingerprintGuard } from './managers/FingerprintGuard';
import { AppDatabase } from './database/Database';
import { IPC, CONFIG } from './types';
import { parseUrl } from './utils/url';

require('events').defaultMaxListeners = CONFIG.MAX_LISTENERS;

// --------------------------------------------------
// Chromium Performance Flags (inspired by Helium browser)
// --------------------------------------------------
app.commandLine.appendSwitch('enable-features',
  'ParallelDownloading,HighEfficiencyMode'
);
// Smoother scrolling & GPU acceleration
app.commandLine.appendSwitch('enable-smooth-scrolling');
app.commandLine.appendSwitch('enable-gpu-rasterization');

if (started) app.quit();

let mainWindow: BaseWindow | null = null;
let tabManager: TabManager;
let spaceManager: SpaceManager;
let compactMode: CompactModeManager;
let glanceManager: GlanceManager;
let splitView: SplitViewManager;
let fingerprintGuard: FingerprintGuard;
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
  spaceManager = new SpaceManager(database, sidebarView, tabManager);

  // CompactMode: controls sidebar auto-hide with layout callback
  compactMode = new CompactModeManager(mainWindow, sidebarView, (sidebarWidth) => {
    const { width, height } = mainWindow!.getContentBounds();
    sidebarView.setBounds({ x: 0, y: 0, width: sidebarWidth, height });
    // Re-layout the active tab view
    tabManager.layoutWithSidebarWidth(sidebarWidth);
  });

  // Glance: link preview overlay
  glanceManager = new GlanceManager(mainWindow, sidebarView, tabManager);

  // SplitView: side-by-side tabs
  splitView = new SplitViewManager(mainWindow, sidebarView, tabManager);

  // FingerprintGuard: privacy protection (Helium-inspired)
  fingerprintGuard = new FingerprintGuard();
  fingerprintGuard.initialize();

  const shortcutManager = new ShortcutManager(tabManager, sidebarView, database, () => mainWindow);

  // Bidirectional linking (Zen pattern: managers reference each other)
  tabManager.setSpaceManager(spaceManager);
  shortcutManager.setSpaceManager(spaceManager);
  shortcutManager.setCompactMode(compactMode);
  shortcutManager.setGlanceManager(glanceManager);
  shortcutManager.setSplitView(splitView);

  // Inject fingerprint protection into each new tab
  tabManager.setOnViewCreated((view) => {
    shortcutManager.attachToView(view);
    fingerprintGuard.injectProtections(view.webContents);
  });

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

  // Hibernate
  ipcMain.on(IPC.HIBERNATE_TAB, (_e, tabId: string) => tabManager.hibernateTab(tabId));

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

  // --------------------------------------------------
  // Workspace IPC Handlers (Zen-inspired)
  // --------------------------------------------------

  ipcMain.on(IPC.REQUEST_SPACES, () => spaceManager.sendSpacesToSidebar());

  ipcMain.on(IPC.SPACE_SWITCH, (_e, spaceId: string) => {
    spaceManager.switchToSpace(spaceId);
  });

  ipcMain.on(IPC.SPACE_CREATE, (_e, data: { name: string; color: string; icon: string }) => {
    spaceManager.createSpace(data.name, data.color, data.icon);
  });

  ipcMain.on(IPC.SPACE_DELETE, (_e, spaceId: string) => {
    spaceManager.deleteSpace(spaceId);
  });

  ipcMain.on(IPC.SPACE_RENAME, (_e, data: { spaceId: string; name: string }) => {
    spaceManager.renameSpace(data.spaceId, data.name);
  });

  ipcMain.on(IPC.SPACE_REORDER, (_e, data: { spaceId: string; newIndex: number }) => {
    spaceManager.reorderSpace(data.spaceId, data.newIndex);
  });

  ipcMain.on(IPC.SPACE_UPDATE_COLOR, (_e, data: { spaceId: string; color: string }) => {
    spaceManager.updateSpaceColor(data.spaceId, data.color);
  });

  // --------------------------------------------------
  // Compact Mode IPC Handlers
  // --------------------------------------------------

  ipcMain.on('compact:toggle', () => compactMode.toggleMode());
  ipcMain.on('compact:set-mode', (_e, mode: string) => {
    compactMode.setMode(mode as any);
  });
  ipcMain.on('compact:mouse-move', (_e, data: { x: number; y: number }) => {
    compactMode.handleMouseMove(data.x, data.y);
  });
  ipcMain.on('compact:lock-popup', () => compactMode.lockForPopup());
  ipcMain.on('compact:unlock-popup', () => compactMode.unlockFromPopup());

  // --------------------------------------------------
  // Glance IPC Handlers (Zen's killer feature)
  // --------------------------------------------------

  ipcMain.on('glance:open', (_e, data: { url: string; x: number; y: number }) => {
    glanceManager.open(data.url, data.x, data.y);
  });
  ipcMain.on('glance:close', () => glanceManager.close());
  ipcMain.on('glance:expand', () => glanceManager.expand());

  // --------------------------------------------------
  // Split View IPC Handlers (Helium + Zen combined)
  // --------------------------------------------------

  ipcMain.on('split:enter', (_e, data: { leftTabId: string; rightTabId?: string; direction?: string }) => {
    splitView.split(data.leftTabId, data.rightTabId, (data.direction as any) || 'horizontal');
  });
  ipcMain.on('split:exit', () => splitView.unsplit());
  ipcMain.on('split:toggle-direction', () => splitView.toggleDirection());
  ipcMain.on('split:swap', () => splitView.swapPanes());
  ipcMain.on('split:resize', (_e, data: { position: number }) => {
    splitView.handleDividerDrag(data.position);
  });

  // --------------------------------------------------
  // Privacy IPC
  // --------------------------------------------------

  ipcMain.on('privacy:toggle', () => {
    fingerprintGuard.setEnabled(!fingerprintGuard.isEnabled());
    sidebarView.webContents.send('privacy:state', {
      enabled: fingerprintGuard.isEnabled(),
    });
  });
  ipcMain.on('privacy:get-state', () => {
    sidebarView.webContents.send('privacy:state', {
      enabled: fingerprintGuard.isEnabled(),
    });
  });
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
