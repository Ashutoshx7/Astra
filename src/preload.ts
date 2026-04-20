const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload bridge — exposes a minimal, typed API to the renderer.
 *
 * Performance note: Each `on*` method stores the listener reference
 * and uses `ipcRenderer.on()` which persists for the lifetime of the
 * renderer process. Since the sidebar is a single long-lived view,
 * this is correct — no cleanup needed.
 *
 * Security: Only specific channels are exposed. No raw IPC access.
 */
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
  reorderTabs: (oldIndex: number, newIndex: number) => ipcRenderer.send('reorder-tabs', { oldIndex, newIndex }),
  hibernateTab: (tabId: string) => ipcRenderer.send('hibernate-tab', tabId),

  // URL suggestions
  searchSuggestions: (query: string) => ipcRenderer.send('search-suggestions', query),

  // Bookmarks
  addBookmark: (url: string, title: string) => ipcRenderer.send('add-bookmark', { url, title }),
  removeBookmark: (url: string) => ipcRenderer.send('remove-bookmark', url),
  getBookmarks: () => ipcRenderer.send('get-bookmarks'),
  getHistory: () => ipcRenderer.send('get-history'),
  clearHistory: () => ipcRenderer.send('clear-history'),

  // Find in page
  findInPage: (text: string) => ipcRenderer.send('find-in-page', text),
  stopFind: () => ipcRenderer.send('find-stop'),

  // Workspaces (inspired by Zen Browser's Spaces)
  switchSpace: (spaceId: string) => ipcRenderer.send('space:switch', spaceId),
  createSpace: (data: { name: string; color: string; icon: string }) => ipcRenderer.send('space:create', data),
  deleteSpace: (spaceId: string) => ipcRenderer.send('space:delete', spaceId),
  renameSpace: (spaceId: string, name: string) => ipcRenderer.send('space:rename', { spaceId, name }),
  reorderSpaces: (spaceId: string, newIndex: number) => ipcRenderer.send('space:reorder', { spaceId, newIndex }),
  updateSpaceColor: (spaceId: string, color: string) => ipcRenderer.send('space:update-color', { spaceId, color }),
  requestSpaces: () => ipcRenderer.send('request-spaces'),

  // Compact Mode (Zen-inspired auto-hide sidebar)
  toggleCompactMode: () => ipcRenderer.send('compact:toggle'),
  setCompactMode: (mode: string) => ipcRenderer.send('compact:set-mode', mode),
  reportMouseMove: (x: number, y: number) => ipcRenderer.send('compact:mouse-move', { x, y }),
  lockPopup: () => ipcRenderer.send('compact:lock-popup'),
  unlockPopup: () => ipcRenderer.send('compact:unlock-popup'),

  // Glance (Zen-inspired link preview)
  openGlance: (url: string, x: number, y: number) => ipcRenderer.send('glance:open', { url, x, y }),
  closeGlance: () => ipcRenderer.send('glance:close'),
  expandGlance: () => ipcRenderer.send('glance:expand'),

  // Split View (Helium + Zen combined)
  splitView: (leftTabId: string, rightTabId?: string, direction?: string) =>
    ipcRenderer.send('split:enter', { leftTabId, rightTabId, direction }),
  exitSplitView: () => ipcRenderer.send('split:exit'),
  toggleSplitDirection: () => ipcRenderer.send('split:toggle-direction'),
  swapSplitPanes: () => ipcRenderer.send('split:swap'),

  // Privacy (Helium-inspired)
  togglePrivacy: () => ipcRenderer.send('privacy:toggle'),
  getPrivacyState: () => ipcRenderer.send('privacy:get-state'),

  // Sidebar Resize
  resizeSidebar: (width: number) => ipcRenderer.send('sidebar:resize', width),

  // Event listeners (Main → Sidebar)
  onTabsUpdated: (cb: Function) => ipcRenderer.on('tabs-updated', (_e: any, d: any) => cb(d)),
  onUrlChanged: (cb: Function) => ipcRenderer.on('url-changed', (_e: any, url: string) => cb(url)),
  onFocusUrlBar: (cb: Function) => ipcRenderer.on('focus-url-bar', () => cb()),
  onSuggestions: (cb: Function) => ipcRenderer.on('suggestions-result', (_e: any, d: any) => cb(d)),
  onBookmarkStatus: (cb: Function) => ipcRenderer.on('bookmark-status', (_e: any, s: boolean) => cb(s)),
  onBookmarksResult: (cb: Function) => ipcRenderer.on('bookmarks-result', (_e: any, d: any) => cb(d)),
  onHistoryResult: (cb: Function) => ipcRenderer.on('history-result', (_e: any, d: any) => cb(d)),
  onDownloadUpdated: (cb: Function) => ipcRenderer.on('download-updated', (_e: any, d: any) => cb(d)),
  onFindResult: (cb: Function) => ipcRenderer.on('find-result', (_e: any, d: any) => cb(d)),
  onShowFindBar: (cb: Function) => ipcRenderer.on('show-find-bar', () => cb()),
  onZoomChanged: (cb: Function) => ipcRenderer.on('zoom-changed', (_e: any, z: number) => cb(z)),
  onSpacesUpdated: (cb: Function) => ipcRenderer.on('spaces-updated', (_e: any, d: any) => cb(d)),
  onUrlCopied: (cb: Function) => ipcRenderer.on('url-copied', (_e: any, url: string) => cb(url)),
  onCompactState: (cb: Function) => ipcRenderer.on('compact:state', (_e: any, d: any) => cb(d)),
  onGlanceOpened: (cb: Function) => ipcRenderer.on('glance:opened', (_e: any, d: any) => cb(d)),
  onGlanceClosed: (cb: Function) => ipcRenderer.on('glance:closed', () => cb()),
  onSplitState: (cb: Function) => ipcRenderer.on('split:state', (_e: any, d: any) => cb(d)),
  onPrivacyState: (cb: Function) => ipcRenderer.on('privacy:state', (_e: any, d: any) => cb(d)),
  onSidebarWidthChanged: (cb: Function) => ipcRenderer.on('sidebar:width-changed', (_e: any, w: number) => cb(w)),
});
