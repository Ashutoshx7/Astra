import { WebContentsView } from 'electron';

// --------------------------------------------------
// Tab Types
// --------------------------------------------------

/** A browser tab managed by the main process */
export interface ManagedTab {
  readonly id: string;
  readonly view: WebContentsView;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
  isSecure: boolean;
}

/** Serializable tab data (sent to sidebar via IPC) */
export interface TabData {
  readonly id: string;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
  isSecure: boolean;
}

export interface TabsUpdatedPayload {
  tabs: TabData[];
  activeTabId: string | null;
}

// --------------------------------------------------
// History & Bookmarks
// --------------------------------------------------

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  visitCount: number;
  lastVisitedAt: number;
}

export interface Bookmark {
  id: number;
  url: string;
  title: string;
  createdAt: number;
}

export interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
}

// --------------------------------------------------
// URL Bar suggestions
// --------------------------------------------------

export interface UrlSuggestion {
  url: string;
  title: string;
  type: 'history' | 'bookmark';
}

// --------------------------------------------------
// IPC Channels (single source of truth)
// --------------------------------------------------

export const IPC = {
  // Sidebar → Main
  NAVIGATE: 'navigate',
  GO_BACK: 'go-back',
  GO_FORWARD: 'go-forward',
  REFRESH: 'refresh',
  NEW_TAB: 'new-tab',
  CLOSE_TAB: 'close-tab',
  SWITCH_TAB: 'switch-tab',
  REQUEST_TABS: 'request-tabs',
  SEARCH_SUGGESTIONS: 'search-suggestions',
  ADD_BOOKMARK: 'add-bookmark',
  REMOVE_BOOKMARK: 'remove-bookmark',
  GET_BOOKMARKS: 'get-bookmarks',

  // Main → Sidebar
  TABS_UPDATED: 'tabs-updated',
  URL_CHANGED: 'url-changed',
  FOCUS_URL_BAR: 'focus-url-bar',
  SUGGESTIONS_RESULT: 'suggestions-result',
  BOOKMARKS_RESULT: 'bookmarks-result',
  BOOKMARK_STATUS: 'bookmark-status',
  DOWNLOAD_UPDATED: 'download-updated',
} as const;

// --------------------------------------------------
// Configuration
// --------------------------------------------------

export const CONFIG = {
  SIDEBAR_WIDTH: 280,
  DEFAULT_URL: 'https://duckduckgo.com',
  NEW_TAB_URL: 'astra://newtab',
  SEARCH_URL: 'https://duckduckgo.com/?q=',
  MAX_LISTENERS: 50,
  MAX_SUGGESTIONS: 6,
  HISTORY_DEBOUNCE_MS: 300,
  WINDOW: {
    WIDTH: 1200,
    HEIGHT: 800,
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600,
    BG_COLOR: '#1a1a2e',
    TITLE: 'Astra',
  },
} as const;
