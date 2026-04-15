const { contextBridge, ipcRenderer } = require('electron');

// Expose safe methods to the renderer (React sidebar)
contextBridge.exposeInMainWorld('astra', {
  // Navigation
  navigate: (url) => ipcRenderer.send('navigate', url),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  refresh: () => ipcRenderer.send('refresh'),

  // Tabs
  newTab: (url) => ipcRenderer.send('new-tab', url),
  closeTab: (tabId) => ipcRenderer.send('close-tab', tabId),
  switchTab: (tabId) => ipcRenderer.send('switch-tab', tabId),

  // Listen for events FROM main process
  onTabUpdate: (callback) => {
    ipcRenderer.on('tab-updated', (_event, data) => callback(data));
  },
  onUrlChanged: (callback) => {
    ipcRenderer.on('url-changed', (_event, url) => callback(url));
  },
});
