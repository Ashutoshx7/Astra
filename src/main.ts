import { app, BaseWindow, WebContentsView } from 'electron';
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
  // This renders YOUR UI (sidebar, URL bar, tab list)
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
  // This renders the actual website the user is browsing
  const webView = new WebContentsView();
  mainWindow.contentView.addChildView(webView);

  // Load the sidebar UI
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    sidebarView.webContents.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    sidebarView.webContents.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Load a default page in the web view
  webView.webContents.loadURL('https://duckduckgo.com');

  // Layout: position sidebar on the left, web page on the right
  const layoutViews = () => {
    const { width, height } = mainWindow.getContentBounds();
    sidebarView.setBounds({ x: 0, y: 0, width: SIDEBAR_WIDTH, height });
    webView.setBounds({ x: SIDEBAR_WIDTH, y: 0, width: width - SIDEBAR_WIDTH, height });
  };

  // Set initial layout
  layoutViews();

  // Re-layout when window is resized
  mainWindow.on('resize', layoutViews);

  // Open DevTools for debugging (remove this later)
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
