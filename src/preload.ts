const { contextBridge, ipcRenderer } = require('electron');

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
  requestTabs: () => ipcRenderer.send('request-tabs'),

  // Listen for events FROM main process
  onTabsUpdated: (callback) => {
    ipcRenderer.on('tabs-updated', (_event, data) => callback(data));
  },
  onUrlChanged: (callback) => {
    ipcRenderer.on('url-changed', (_event, url) => callback(url));
  },
});
