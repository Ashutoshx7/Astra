import { app, BaseWindow, WebContentsView, ipcMain } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

// Sidebar width in pixels
const SIDEBAR_WIDTH = 280;

const createWindow = () => {
  // Create the base window — a lightweight container
  const mainWindow = new BaseWindow({
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

  // === SIDEBAR VIEW ===
  const sidebarView = new WebContentsView({
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.contentView.addChildView(sidebarView);

  // === WEB VIEW ===
  const webView = new WebContentsView();
  mainWindow.contentView.addChildView(webView);

  // Load sidebar UI
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    sidebarView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    sidebarView.webContents.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Load default page
  webView.webContents.loadURL('https://duckduckgo.com');

  // Layout
  const layoutViews = () => {
    const { width, height } = mainWindow.getContentBounds();
    sidebarView.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height });
    webView.setBounds({ x: SIDEBAR_WIDTH, y: 0, width: width - SIDEBAR_WIDTH, height });
  };

  layoutViews();
  mainWindow.on('resize', layoutViews);

  // =============================================
  // IPC HANDLERS — Sidebar talks to main process
  // =============================================

  // Navigate to URL
  ipcMain.on('navigate', (_event, url: string) => {
    let finalUrl = url.trim();
    if (!finalUrl.includes('.') || finalUrl.includes(' ')) {
      finalUrl = `https://duckduckgo.com/?q=${encodeURIComponent(finalUrl)}`;
    } else if (!finalUrl.startsWith('http')) {
      finalUrl = 'https://' + finalUrl;
    }
    console.log('[Astra] Navigating to:', finalUrl);
    webView.webContents.loadURL(finalUrl);
  });

  // Back / Forward / Refresh
  ipcMain.on('go-back', () => {
    console.log('[Astra] Go back');
    if (webView.webContents.canGoBack()) webView.webContents.goBack();
  });

  ipcMain.on('go-forward', () => {
    console.log('[Astra] Go forward');
    if (webView.webContents.canGoForward()) webView.webContents.goForward();
  });

  ipcMain.on('refresh', () => {
    console.log('[Astra] Refresh');
    webView.webContents.reload();
  });

  // =============================================
  // EVENTS — Main process talks back to sidebar
  // =============================================

  webView.webContents.on('page-title-updated', (_event, title) => {
    sidebarView.webContents.send('tab-updated', {
      title,
      url: webView.webContents.getURL(),
    });
  });

  webView.webContents.on('did-navigate', (_event, url) => {
    sidebarView.webContents.send('url-changed', url);
  });

  webView.webContents.on('did-navigate-in-page', (_event, url) => {
    sidebarView.webContents.send('url-changed', url);
  });

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
