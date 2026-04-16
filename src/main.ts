import { app, BaseWindow, WebContentsView, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

if (started) {
  app.quit();
}

const SIDEBAR_WIDTH = 280;

// =============================================
// TAB STORAGE — each tab is a WebContentsView
// =============================================
interface ManagedTab {
  id: string;
  view: WebContentsView;
  title: string;
  url: string;
  favicon: string;
}

let tabs: ManagedTab[] = [];
let activeTabId: string | null = null;
let mainWindow: BaseWindow;
let sidebarView: WebContentsView;

// Generate unique tab IDs
let tabCounter = 0;
const nextTabId = () => `tab-${++tabCounter}`;

// =============================================
// TAB MANAGEMENT FUNCTIONS
// =============================================

function createTab(url = 'https://duckduckgo.com'): ManagedTab {
  const id = nextTabId();

  const view = new WebContentsView();
  mainWindow.contentView.addChildView(view);

  // Hide it initially (will be shown if it's the active tab)
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

  // Load the URL
  view.webContents.loadURL(url);

  // When page title changes, update tab state and notify sidebar
  view.webContents.on('page-title-updated', (_event, title) => {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      tab.title = title;
      tab.url = view.webContents.getURL();
      sendTabsToSidebar();
    }
  });

  // When URL changes, update tab state and notify sidebar
  view.webContents.on('did-navigate', (_event, newUrl) => {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      tab.url = newUrl;
      sendTabsToSidebar();
    }
    if (id === activeTabId) {
      sidebarView.webContents.send('url-changed', newUrl);
    }
  });

  view.webContents.on('did-navigate-in-page', (_event, newUrl) => {
    const tab = tabs.find(t => t.id === id);
    if (tab) {
      tab.url = newUrl;
    }
    if (id === activeTabId) {
      sidebarView.webContents.send('url-changed', newUrl);
    }
  });

  const tab: ManagedTab = {
    id,
    view,
    title: 'New Tab',
    url,
    favicon: '🌐',
  };

  tabs.push(tab);

  // Attach keyboard shortcuts to this view
  if ((global as any).__attachShortcuts) {
    (global as any).__attachShortcuts(tab.view);
  }

  return tab;
}

function switchToTab(tabId: string) {
  console.log('[Astra] switchToTab called:', tabId, '| total tabs:', tabs.length);
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) {
    console.log('[Astra] Tab not found!');
    return;
  }

  activeTabId = tabId;
  layoutViews();
  sidebarView.webContents.send('url-changed', tab.url);
  sendTabsToSidebar();
  console.log('[Astra] Switched to tab:', tabId, '| title:', tab.title);
}

function closeTab(tabId: string) {
  const tabIndex = tabs.findIndex(t => t.id === tabId);
  if (tabIndex === -1) return;

  const tab = tabs[tabIndex];
  mainWindow.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tabs.splice(tabIndex, 1);

  if (activeTabId === tabId) {
    if (tabs.length > 0) {
      const newIndex = Math.min(tabIndex, tabs.length - 1);
      switchToTab(tabs[newIndex].id);
    } else {
      const newTab = createTab();
      switchToTab(newTab.id);
    }
  }

  sendTabsToSidebar();
}

function layoutViews() {
  if (!mainWindow) return;
  const { width, height } = mainWindow.getContentBounds();

  sidebarView.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height });

  // Remove ALL tab views first, then add only the active one
  for (const tab of tabs) {
    try {
      mainWindow.contentView.removeChildView(tab.view);
    } catch (e) {
      // View might not be a child — that's fine
    }
  }

  // Add only the active tab's view (on top of everything)
  const activeTab = tabs.find(t => t.id === activeTabId);
  if (activeTab) {
    mainWindow.contentView.addChildView(activeTab.view);
    activeTab.view.setBounds({
      x: SIDEBAR_WIDTH,
      y: 0,
      width: width - SIDEBAR_WIDTH,
      height,
    });
  }
}

function sendTabsToSidebar() {
  const tabData = tabs.map(t => ({
    id: t.id,
    title: t.title,
    url: t.url,
    favicon: t.favicon,
  }));
  sidebarView.webContents.send('tabs-updated', {
    tabs: tabData,
    activeTabId,
  });
}

// =============================================
// WINDOW CREATION
// =============================================

const createWindow = () => {
  mainWindow = new BaseWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Astra',
    backgroundColor: '#1a1a2e',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#1a1a2e',
      symbolColor: '#e0e0e0',
      height: 40,
    },
  });

  sidebarView = new WebContentsView({
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

  // Create the first tab
  const firstTab = createTab('https://duckduckgo.com');
  switchToTab(firstTab.id);

  mainWindow.on('resize', layoutViews);

  // =============================================
  // IPC HANDLERS
  // =============================================

  // Sidebar asks for current tabs (when React mounts)
  ipcMain.on('request-tabs', () => {
    sendTabsToSidebar();
  });

  ipcMain.on('navigate', (_event, url: string) => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;

    let finalUrl = url.trim();
    if (!finalUrl.includes('.') || finalUrl.includes(' ')) {
      finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(finalUrl)}`;
    } else if (!finalUrl.startsWith('http')) {
      finalUrl = 'https://' + finalUrl;
    }
    tab.view.webContents.loadURL(finalUrl);
  });

  ipcMain.on('go-back', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack();
    }
  });

  ipcMain.on('go-forward', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward();
    }
  });

  ipcMain.on('refresh', () => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) tab.view.webContents.reload();
  });

  ipcMain.on('new-tab', (_event, url?: string) => {
    const newTab = createTab(url || 'https://duckduckgo.com');
    switchToTab(newTab.id);
  });

  ipcMain.on('close-tab', (_event, tabId: string) => {
    closeTab(tabId);
  });

  ipcMain.on('switch-tab', (_event, tabId: string) => {
    switchToTab(tabId);
  });

  // =============================================
  // KEYBOARD SHORTCUTS
  // =============================================

  function handleShortcut(event: Electron.Event, input: Electron.Input) {
    if (input.type !== 'keyDown') return;

    const ctrl = input.control || input.meta; // Ctrl on Linux/Win, Cmd on Mac

    // Ctrl+T → New tab
    if (ctrl && input.key === 't') {
      event.preventDefault();
      const newTab = createTab('https://duckduckgo.com');
      switchToTab(newTab.id);
    }

    // Ctrl+W → Close current tab
    if (ctrl && input.key === 'w') {
      event.preventDefault();
      if (activeTabId) closeTab(activeTabId);
    }

    // Ctrl+Tab → Next tab
    if (ctrl && input.key === 'Tab' && !input.shift) {
      event.preventDefault();
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);
      const nextIndex = (currentIndex + 1) % tabs.length;
      switchToTab(tabs[nextIndex].id);
    }

    // Ctrl+Shift+Tab → Previous tab
    if (ctrl && input.key === 'Tab' && input.shift) {
      event.preventDefault();
      const currentIndex = tabs.findIndex(t => t.id === activeTabId);
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      switchToTab(tabs[prevIndex].id);
    }

    // Ctrl+L → Focus URL bar
    if (ctrl && input.key === 'l') {
      event.preventDefault();
      sidebarView.webContents.send('focus-url-bar');
    }

    // Ctrl+R or F5 → Refresh
    if ((ctrl && input.key === 'r') || input.key === 'F5') {
      event.preventDefault();
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) tab.view.webContents.reload();
    }
  }

  // Listen for shortcuts on the sidebar
  sidebarView.webContents.on('before-input-event', handleShortcut);

  // Listen for shortcuts on ALL web views (existing + future)
  function attachShortcutsToView(view: WebContentsView) {
    view.webContents.on('before-input-event', handleShortcut);
  }

  // Attach to existing tabs
  for (const tab of tabs) {
    attachShortcutsToView(tab.view);
  }

  // Store the function so createTab can use it
  (global as any).__attachShortcuts = attachShortcutsToView;

  // DevTools for debugging (remove later)
  sidebarView.webContents.openDevTools({ mode: 'detach' });
};

app.on('ready', createWindow);

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
