// --------------------------------------------------
// Renderer-only types (React UI)
// --------------------------------------------------

export interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
  isSecure: boolean;
  isPinned: boolean;
  isHibernated: boolean;
  zoomLevel: number;
  spaceId: string;
}

export interface SpaceData {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
}

export interface UrlSuggestion {
  url: string;
  title: string;
  type: 'history' | 'bookmark';
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visitCount: number;
  lastVisitedAt: number;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: string;
}

export interface FindResult {
  activeMatchOrdinal: number;
  matches: number;
}

export interface CompactState {
  mode: string;
  expanded: boolean;
  sidebarVisible: boolean;
  sidebarWidth: number;
  animating?: 'hiding' | 'showing' | null;
}

export interface GlanceState {
  active: boolean;
  url: string;
}

export interface SpaceContextMenu {
  x: number;
  y: number;
  spaceId: string;
}

export type PanelMode = 'tabs' | 'spaces' | 'bookmarks' | 'history' | 'settings';
export type SettingsSubPanel = 'main' | 'bookmarks' | 'history';

// --------------------------------------------------
// Window.astra API surface
// --------------------------------------------------

declare global {
  interface Window {
    astra: {
      navigate: (url: string) => void;
      goBack: () => void;
      goForward: () => void;
      refresh: () => void;
      newTab: (url?: string) => void;
      closeTab: (tabId: string) => void;
      switchTab: (tabId: string) => void;
      requestTabs: () => void;
      pinTab: (tabId: string) => void;
      unpinTab: (tabId: string) => void;
      reorderTabs: (oldIndex: number, newIndex: number) => void;
      hibernateTab: (tabId: string) => void;
      searchSuggestions: (query: string) => void;
      addBookmark: (url: string, title: string) => void;
      removeBookmark: (url: string) => void;
      getBookmarks: () => void;
      getHistory: () => void;
      clearHistory: () => void;
      findInPage: (text: string) => void;
      stopFind: () => void;
      switchSpace: (spaceId: string) => void;
      createSpace: (data: { name: string; color: string; icon: string }) => void;
      deleteSpace: (spaceId: string) => void;
      renameSpace: (spaceId: string, name: string) => void;
      reorderSpaces: (spaceId: string, newIndex: number) => void;
      updateSpaceColor: (spaceId: string, color: string) => void;
      requestSpaces: () => void;
      toggleCompactMode: () => void;
      setCompactMode: (mode: string) => void;
      reportMouseMove: (x: number, y: number) => void;
      lockPopup: () => void;
      unlockPopup: () => void;
      edgeEnter: () => void;
      edgeLeave: () => void;
      edgeCancelHide: () => void;
      openGlance: (url: string, x: number, y: number) => void;
      closeGlance: () => void;
      expandGlance: () => void;
      resizeSidebar: (width: number) => void;
      // Window Controls (Zen-style custom buttons)
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      closeWindow: () => void;
      toolbarExpand: () => void;
      toolbarCollapse: () => void;
      onTabsUpdated: (cb: (data: any) => void) => void;
      onUrlChanged: (cb: (url: string) => void) => void;
      onFocusUrlBar: (cb: () => void) => void;
      onSuggestions: (cb: (s: UrlSuggestion[]) => void) => void;
      onBookmarkStatus: (cb: (b: boolean) => void) => void;
      onBookmarksResult: (cb: (b: Bookmark[]) => void) => void;
      onHistoryResult: (cb: (b: HistoryEntry[]) => void) => void;
      onDownloadUpdated: (cb: (d: DownloadItem) => void) => void;
      onFindResult: (cb: (r: FindResult | null) => void) => void;
      onShowFindBar: (cb: () => void) => void;
      onZoomChanged: (cb: (z: number) => void) => void;
      onSpacesUpdated: (cb: (data: { spaces: SpaceData[]; activeSpaceId: string }) => void) => void;
      onUrlCopied: (cb: (url: string) => void) => void;
      onCompactState: (cb: (state: CompactState) => void) => void;
      onGlanceOpened: (cb: (data: { url: string }) => void) => void;
      onGlanceClosed: (cb: () => void) => void;
      onSidebarWidthChanged: (cb: (width: number) => void) => void;
      onMaximizedChanged: (cb: (isMaximized: boolean) => void) => void;
      onToolbarExpanded: (cb: (expanded: boolean) => void) => void;
    };
  }
}
