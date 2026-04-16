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
  pinTab: (tabId: string) => ipcRenderer.send('pin-tab', tabId),
  unpinTab: (tabId: string) => ipcRenderer.send('unpin-tab', tabId),

  // URL suggestions
  searchSuggestions: (query: string) => ipcRenderer.send('search-suggestions', query),

  // Bookmarks
  addBookmark: (url: string, title: string) => ipcRenderer.send('add-bookmark', { url, title }),
  removeBookmark: (url: string) => ipcRenderer.send('remove-bookmark', url),
  getBookmarks: () => ipcRenderer.send('get-bookmarks'),

  // Find in page
  findInPage: (text: string) => ipcRenderer.send('find-in-page', text),
  stopFind: () => ipcRenderer.send('find-stop'),

  // Event listeners (Main → Sidebar)
  onTabsUpdated: (cb: Function) => ipcRenderer.on('tabs-updated', (_e: any, d: any) => cb(d)),
  onUrlChanged: (cb: Function) => ipcRenderer.on('url-changed', (_e: any, url: string) => cb(url)),
  onFocusUrlBar: (cb: Function) => ipcRenderer.on('focus-url-bar', () => cb()),
  onSuggestions: (cb: Function) => ipcRenderer.on('suggestions-result', (_e: any, d: any) => cb(d)),
  onBookmarkStatus: (cb: Function) => ipcRenderer.on('bookmark-status', (_e: any, s: boolean) => cb(s)),
  onBookmarksResult: (cb: Function) => ipcRenderer.on('bookmarks-result', (_e: any, d: any) => cb(d)),
  onDownloadUpdated: (cb: Function) => ipcRenderer.on('download-updated', (_e: any, d: any) => cb(d)),
  onFindResult: (cb: Function) => ipcRenderer.on('find-result', (_e: any, d: any) => cb(d)),
  onShowFindBar: (cb: Function) => ipcRenderer.on('show-find-bar', () => cb()),
  onZoomChanged: (cb: Function) => ipcRenderer.on('zoom-changed', (_e: any, z: number) => cb(z)),
});
