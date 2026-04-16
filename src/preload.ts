const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('astra', {
  // Navigation
  navigate: (url: string) => ipcRenderer.send('navigate', url),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  refresh: () => ipcRenderer.send('refresh'),

  // Tabs
  newTab: (url?: string) => ipcRenderer.send('new-tab', url),
  closeTab: (tabId: string) => ipcRenderer.send('close-tab', tabId),
  switchTab: (tabId: string) => ipcRenderer.send('switch-tab', tabId),
  requestTabs: () => ipcRenderer.send('request-tabs'),

  // URL suggestions
  searchSuggestions: (query: string) => ipcRenderer.send('search-suggestions', query),

  // Bookmarks
  addBookmark: (url: string, title: string) => ipcRenderer.send('add-bookmark', { url, title }),
  removeBookmark: (url: string) => ipcRenderer.send('remove-bookmark', url),
  getBookmarks: () => ipcRenderer.send('get-bookmarks'),

  // Event listeners (Main → Sidebar)
  onTabsUpdated: (cb: Function) => ipcRenderer.on('tabs-updated', (_e: any, data: any) => cb(data)),
  onUrlChanged: (cb: Function) => ipcRenderer.on('url-changed', (_e: any, url: string) => cb(url)),
  onFocusUrlBar: (cb: Function) => ipcRenderer.on('focus-url-bar', () => cb()),
  onSuggestions: (cb: Function) => ipcRenderer.on('suggestions-result', (_e: any, data: any) => cb(data)),
  onBookmarkStatus: (cb: Function) => ipcRenderer.on('bookmark-status', (_e: any, status: boolean) => cb(status)),
  onBookmarksResult: (cb: Function) => ipcRenderer.on('bookmarks-result', (_e: any, data: any) => cb(data)),
  onDownloadUpdated: (cb: Function) => ipcRenderer.on('download-updated', (_e: any, data: any) => cb(data)),
});
