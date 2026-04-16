import { WebContentsView } from 'electron';

/**
 * Represents a browser tab managed by the main process.
 * Each tab owns a separate WebContentsView (Chromium renderer).
 */
export interface ManagedTab {
  readonly id: string;
  readonly view: WebContentsView;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
}

/**
 * Serializable tab data sent to the sidebar via IPC.
 * Excludes the WebContentsView reference (not transferable over IPC).
 */
export interface TabData {
  readonly id: string;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
}

/** Payload sent on the 'tabs-updated' IPC channel */
export interface TabsUpdatedPayload {
  tabs: TabData[];
  activeTabId: string | null;
}

/** IPC channel names — single source of truth */
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

  // Main → Sidebar
  TABS_UPDATED: 'tabs-updated',
  URL_CHANGED: 'url-changed',
  FOCUS_URL_BAR: 'focus-url-bar',
} as const;

/** Browser configuration constants */
export const CONFIG = {
  SIDEBAR_WIDTH: 280,
  DEFAULT_URL: 'https://duckduckgo.com',
  SEARCH_URL: 'https://duckduckgo.com/?q=',
  MAX_LISTENERS: 50,
  WINDOW: {
    WIDTH: 1200,
    HEIGHT: 800,
    MIN_WIDTH: 800,
    MIN_HEIGHT: 600,
    BG_COLOR: '#1a1a2e',
    TITLE: 'Astra',
  },
} as const;
