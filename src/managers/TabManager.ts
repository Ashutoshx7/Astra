import { BaseWindow, WebContentsView, Menu } from 'electron';
import { ManagedTab, TabData, SessionTab, CONFIG, IPC } from '../types';
import { AppDatabase } from '../database/Database';
import { DownloadManager } from './DownloadManager';
import { getNewTabPageUrl } from '../pages/newtab';
import type { SpaceManager } from './SpaceManager';

/**
 * TabManager — owns the lifecycle of all browser tabs.
 *
 * Performance optimizations:
 *   - O(1) tab lookups via Map index
 *   - Throttled IPC sends (max 1 per 100ms)
 *   - Smart layout swaps (only swap when active tab changes)
 *   - Cached new tab page URL
 */
export class TabManager {
  private tabs: ManagedTab[] = [];
  private readonly tabIndex: Map<string, ManagedTab> = new Map(); // O(1) lookups
  private activeTabId: string | null = null;
  private currentlyAttachedTabId: string | null = null; // Track what's actually in the DOM
  private tabCounter = 0;
  private onViewCreated: ((view: WebContentsView) => void) | null = null;
  private readonly downloadManager: DownloadManager;
  private readonly newTabPageUrl: string; // Cached — computed once

  // Throttle state for sendTabsToSidebar
  private sendPending = false;
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly SEND_THROTTLE_MS = 100;
  private spaceManager: SpaceManager | null = null;
  private sidebarWidth: number = CONFIG.SIDEBAR_WIDTH;

  // Zen-style floating content card.
  // The VISUAL gap between sidebar and content is created by CSS padding
  // on the sidebar renderer, NOT by a gap between BrowserView bounds.
  // This eliminates GPU compositor desync during resize.
  private static readonly CONTENT_INSET = 8;
  private static readonly CONTENT_RADIUS = 10;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly database: AppDatabase,
  ) {
    this.downloadManager = new DownloadManager(sidebarView);
    this.newTabPageUrl = getNewTabPageUrl(); // Cache the data URL
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  setOnViewCreated(cb: (view: WebContentsView) => void): void {
    this.onViewCreated = cb;
  }

  setSpaceManager(sm: SpaceManager): void {
    this.spaceManager = sm;
  }

  setSidebarWidth(width: number): void {
    this.sidebarWidth = Math.max(
      CONFIG.SIDEBAR_MIN_WIDTH,
      Math.min(CONFIG.SIDEBAR_MAX_WIDTH, width),
    );
  }

  getSidebarWidth(): number {
    return this.sidebarWidth;
  }

  createTab(url?: string, isPinned = false, spaceId?: string): ManagedTab {
    const id = this.nextId();
    const view = new WebContentsView();

    // Performance: do NOT add to contentView yet — only attach when the tab becomes active.
    // Adding every tab immediately wastes GPU compositor memory for background tabs.
    // The view IS created so webContents starts loading in the background (preloading).
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    const loadUrl = url || this.newTabPageUrl;
    view.webContents.loadURL(loadUrl);

    this.attachTabEvents(id, view);
    this.attachContextMenu(view);

    view.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
      const newTab = this.createTab(linkUrl);
      this.switchToTab(newTab.id);
      return { action: 'deny' };
    });

    this.downloadManager.attachToView(view);

    const tab: ManagedTab = {
      id, view,
      title: 'New Tab',
      url: loadUrl,
      favicon: '🌐',
      isLoading: true,
      isSecure: false,
      isPinned,
      isHibernated: false,
      zoomLevel: 1.0,
      spaceId: spaceId || this.spaceManager?.getActiveSpaceId() || '',
    };

    // Insert pinned tabs at the start
    if (isPinned) {
      const firstUnpinned = this.tabs.findIndex(t => !t.isPinned);
      if (firstUnpinned === -1) this.tabs.push(tab);
      else this.tabs.splice(firstUnpinned, 0, tab);
    } else {
      this.tabs.push(tab);
    }

    // Add to index
    this.tabIndex.set(id, tab);

    this.onViewCreated?.(view);
    return tab;
  }

  switchToTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab) return;

    this.activeTabId = tabId;

    // Wake hibernated tab on switch
    if (tab.isHibernated) {
      this.wakeTab(tab);
    }

    this.layoutViews();
    this.sidebarView.webContents.send(IPC.URL_CHANGED, tab.url);
    this.sidebarView.webContents.send(IPC.BOOKMARK_STATUS, this.database.isBookmarked(tab.url));
    this.sidebarView.webContents.send(IPC.ZOOM_CHANGED, Math.round(tab.zoomLevel * 100));
    this.scheduleSend();
  }

  layout(): void {
    this.layoutViews();
  }

  closeTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab || tab.isPinned) return;

    const index = this.tabs.indexOf(tab);
    // View may not be attached if it was created but never activated — try/catch handles both cases
    try { this.mainWindow.contentView.removeChildView(tab.view); } catch { /* not attached, ok */ }

    if (this.currentlyAttachedTabId === tabId) {
      this.currentlyAttachedTabId = null;
    }

    tab.view.webContents.close();
    this.tabs.splice(index, 1);
    this.tabIndex.delete(tabId); // Remove from index

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.switchToTab(this.tabs[newIndex].id);
      } else {
        const newTab = this.createTab();
        this.switchToTab(newTab.id);
      }
    }

    this.scheduleSend();
  }

  // --------------------------------------------------
  // Navigation
  // --------------------------------------------------

  navigateActiveTab(url: string): void {
    this.getActiveTab()?.view.webContents.loadURL(url);
  }

  goBack(): void {
    const tab = this.getActiveTab();
    if (tab?.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack();
    }
  }

  goForward(): void {
    const tab = this.getActiveTab();
    if (tab?.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward();
    }
  }

  reload(): void {
    this.getActiveTab()?.view.webContents.reload();
  }

  nextTab(): void {
    if (this.tabs.length <= 1) return;
    const i = this.tabs.findIndex(t => t.id === this.activeTabId);
    this.switchToTab(this.tabs[(i + 1) % this.tabs.length].id);
  }

  previousTab(): void {
    if (this.tabs.length <= 1) return;
    const i = this.tabs.findIndex(t => t.id === this.activeTabId);
    this.switchToTab(this.tabs[(i - 1 + this.tabs.length) % this.tabs.length].id);
  }

  // --------------------------------------------------
  // Pin/Unpin
  // --------------------------------------------------

  pinTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab || tab.isPinned) return;

    tab.isPinned = true;
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    const firstUnpinned = this.tabs.findIndex(t => !t.isPinned);
    if (firstUnpinned === -1) this.tabs.push(tab);
    else this.tabs.splice(firstUnpinned, 0, tab);

    this.scheduleSend();
  }

  unpinTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab || !tab.isPinned) return;

    tab.isPinned = false;
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    const firstUnpinned = this.tabs.findIndex(t => !t.isPinned);
    if (firstUnpinned === -1) this.tabs.push(tab);
    else this.tabs.splice(firstUnpinned, 0, tab);

    this.scheduleSend();
  }

  reorderTabs(oldIndex: number, newIndex: number): void {
    if (oldIndex < 0 || oldIndex >= this.tabs.length) return;
    if (newIndex < 0 || newIndex >= this.tabs.length) return;
    if (oldIndex === newIndex) return;

    const [tab] = this.tabs.splice(oldIndex, 1);
    this.tabs.splice(newIndex, 0, tab);

    this.scheduleSend();
  }

  // --------------------------------------------------
  // Zoom
  // --------------------------------------------------

  zoomIn(): void {
    const tab = this.getActiveTab();
    if (!tab || tab.zoomLevel >= CONFIG.ZOOM_MAX) return;
    tab.zoomLevel = Math.min(tab.zoomLevel + CONFIG.ZOOM_STEP, CONFIG.ZOOM_MAX);
    tab.view.webContents.setZoomFactor(tab.zoomLevel);
    this.sidebarView.webContents.send(IPC.ZOOM_CHANGED, Math.round(tab.zoomLevel * 100));
  }

  zoomOut(): void {
    const tab = this.getActiveTab();
    if (!tab || tab.zoomLevel <= CONFIG.ZOOM_MIN) return;
    tab.zoomLevel = Math.max(tab.zoomLevel - CONFIG.ZOOM_STEP, CONFIG.ZOOM_MIN);
    tab.view.webContents.setZoomFactor(tab.zoomLevel);
    this.sidebarView.webContents.send(IPC.ZOOM_CHANGED, Math.round(tab.zoomLevel * 100));
  }

  zoomReset(): void {
    const tab = this.getActiveTab();
    if (!tab) return;
    tab.zoomLevel = 1.0;
    tab.view.webContents.setZoomFactor(1.0);
    this.sidebarView.webContents.send(IPC.ZOOM_CHANGED, 100);
  }

  // --------------------------------------------------
  // Find in page
  // --------------------------------------------------

  findInPage(text: string): void {
    const tab = this.getActiveTab();
    if (!tab || !text) return;
    tab.view.webContents.findInPage(text);
  }

  stopFind(): void {
    this.getActiveTab()?.view.webContents.stopFindInPage('clearSelection');
  }

  // --------------------------------------------------
  // Session restore
  // --------------------------------------------------

  saveSession(): void {
    const sessionTabs: SessionTab[] = this.tabs
      .filter(t => !t.url.startsWith('data:') && !t.url.startsWith('astra://'))
      .map((t, i) => ({
        url: t.url, title: t.title, isPinned: t.isPinned, position: i,
        spaceId: t.spaceId,
      }));
    this.database.saveSession(sessionTabs);
    console.log(`[Astra] 💾 Session saved: ${sessionTabs.length} tabs`);
  }

  restoreSession(): boolean {
    const sessionTabs = this.database.restoreSession();
    if (sessionTabs.length === 0) return false;

    for (const st of sessionTabs) {
      this.createTab(st.url, st.isPinned, st.spaceId || undefined);
    }

    if (this.tabs.length > 0) this.switchToTab(this.tabs[0].id);
    console.log(`[Astra] 🔄 Session restored: ${sessionTabs.length} tabs`);
    return true;
  }

  // --------------------------------------------------
  // State getters
  // --------------------------------------------------

  getActiveTabId(): string | null { return this.activeTabId; }
  getActiveTabUrl(): string { return this.getActiveTab()?.url || ''; }
  getActiveTabTitle(): string { return this.getActiveTab()?.title || ''; }
  getAllViews(): WebContentsView[] { return this.tabs.map(t => t.view); }
  getAllTabIds(): string[] { return this.tabs.map(t => t.id); }

  /** Public tab lookup (for SplitViewManager) */
  findTabById(id: string): ManagedTab | undefined {
    return this.tabIndex.get(id);
  }

  /** Get tabs belonging to a specific workspace (for SpaceManager) */
  getTabsForSpace(spaceId: string): ManagedTab[] {
    return this.tabs.filter(t => t.spaceId === spaceId || t.isPinned);
  }

  /** Move all tabs from one workspace to another (used during space deletion) */
  moveTabsToSpace(fromSpaceId: string, toSpaceId: string): void {
    for (const tab of this.tabs) {
      if (tab.spaceId === fromSpaceId) {
        tab.spaceId = toSpaceId;
      }
    }
    this.scheduleSend();
  }

  /**
   * Hibernate a tab — crash its renderer to reclaim memory (Helium pattern).
   * The URL and scroll position are saved so the tab can be restored on click.
   */
  hibernateTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab || tab.id === this.activeTabId || tab.isHibernated) return;

    // Don't hibernate if media is playing
    if (tab.view.webContents.isCurrentlyAudible()) return;

    try {
      tab.view.webContents.forcefullyCrashRenderer();
      tab.isHibernated = true;
      tab.isLoading = false;
      this.scheduleSend();
      console.log(`[Astra] 🌙 Hibernated tab: ${tab.title}`);
    } catch (err) {
      console.error('[Astra] Hibernate failed:', err);
    }
  }

  /** Wake a hibernated tab by reloading its URL */
  private wakeTab(tab: ManagedTab): void {
    if (!tab.isHibernated) return;
    tab.isHibernated = false;
    tab.view.webContents.loadURL(tab.url);
    console.log(`[Astra] ☀️ Woke tab: ${tab.title}`);
  }

  /**
   * Send full tab state to sidebar.
   * Called directly only when explicitly requested (e.g. IPC.REQUEST_TABS).
   * For internal use, prefer `scheduleSend()` which throttles.
   */
  sendTabsToSidebar(): void {
    const activeSpaceId = this.spaceManager?.getActiveSpaceId() || '';

    // Only send tabs for the active workspace + pinned (essential) tabs
    const visibleTabs = activeSpaceId
      ? this.tabs.filter(t => t.spaceId === activeSpaceId || t.isPinned)
      : this.tabs;

    const tabData: TabData[] = visibleTabs.map(t => ({
      id: t.id, title: t.title, url: t.url, favicon: t.favicon,
      isLoading: t.isLoading, isSecure: t.isSecure,
      isPinned: t.isPinned, isHibernated: t.isHibernated,
      zoomLevel: t.zoomLevel, spaceId: t.spaceId,
    }));
    this.sidebarView.webContents.send(IPC.TABS_UPDATED, {
      tabs: tabData,
      activeTabId: this.activeTabId,
      activeSpaceId,
    });
    this.sendPending = false;
  }

  // --------------------------------------------------
  // Private: Performance-critical internals
  // --------------------------------------------------

  /**
   * Throttled send — coalesces multiple rapid state changes into one IPC message.
   * Without this, a single page load would send 5-8 IPC messages.
   */
  private scheduleSend(): void {
    if (this.sendTimer) return; // Already scheduled

    this.sendPending = true;
    this.sendTimer = setTimeout(() => {
      this.sendTimer = null;
      if (this.sendPending) {
        this.sendTabsToSidebar();
      }
    }, TabManager.SEND_THROTTLE_MS);
  }

  private nextId(): string { return `tab-${++this.tabCounter}`; }

  /** O(1) tab lookup via Map index */
  private findTab(id: string): ManagedTab | undefined {
    return this.tabIndex.get(id);
  }

  private getActiveTab(): ManagedTab | undefined {
    return this.activeTabId ? this.findTab(this.activeTabId) : undefined;
  }

  private attachTabEvents(id: string, view: WebContentsView): void {
    view.webContents.on('page-title-updated', (_e, title) => {
      const tab = this.findTab(id);
      if (tab) {
        tab.title = title;
        tab.url = view.webContents.getURL();
        this.database.recordVisit(tab.url, title);
        this.scheduleSend(); // Throttled, not direct
      }
    });

    view.webContents.on('page-favicon-updated', (_e, favicons) => {
      const tab = this.findTab(id);
      if (tab && favicons.length > 0) {
        tab.favicon = favicons[0];
        this.scheduleSend();
      }
    });

    view.webContents.on('did-navigate', (_e, newUrl) => {
      const tab = this.findTab(id);
      if (tab) {
        tab.url = newUrl;
        tab.isSecure = newUrl.startsWith('https://');
        this.scheduleSend();
      }
      if (id === this.activeTabId) {
        this.sidebarView.webContents.send(IPC.URL_CHANGED, newUrl);
        this.sidebarView.webContents.send(IPC.BOOKMARK_STATUS, this.database.isBookmarked(newUrl));
      }
    });

    view.webContents.on('did-navigate-in-page', (_e, newUrl) => {
      const tab = this.findTab(id);
      if (tab) tab.url = newUrl;
      if (id === this.activeTabId) {
        this.sidebarView.webContents.send(IPC.URL_CHANGED, newUrl);
      }
    });

    view.webContents.on('did-start-loading', () => {
      const tab = this.findTab(id);
      if (tab) { tab.isLoading = true; this.scheduleSend(); }
    });

    view.webContents.on('did-stop-loading', () => {
      const tab = this.findTab(id);
      if (tab) { tab.isLoading = false; this.scheduleSend(); }
    });

    view.webContents.on('found-in-page', (_e, result) => {
      this.sidebarView.webContents.send(IPC.FIND_RESULT, {
        activeMatchOrdinal: result.activeMatchOrdinal,
        matches: result.matches,
      });
    });
  }

  private attachContextMenu(view: WebContentsView): void {
    view.webContents.on('context-menu', (_e, params) => {
      const items: Electron.MenuItemConstructorOptions[] = [];

      if (params.linkURL) {
        items.push(
          {
            label: 'Open Link in New Tab', click: () => {
              const t = this.createTab(params.linkURL);
              this.switchToTab(t.id);
            }
          },
          { label: 'Copy Link Address', click: () => require('electron').clipboard.writeText(params.linkURL) },
          { type: 'separator' },
        );
      }

      if (params.selectionText) {
        items.push({ label: 'Copy', role: 'copy' }, { type: 'separator' });
      }

      items.push(
        { label: 'Back', enabled: view.webContents.navigationHistory.canGoBack(), click: () => view.webContents.navigationHistory.goBack() },
        { label: 'Forward', enabled: view.webContents.navigationHistory.canGoForward(), click: () => view.webContents.navigationHistory.goForward() },
        { label: 'Reload', click: () => view.webContents.reload() },
        { type: 'separator' },
        { label: 'Zoom In', click: () => this.zoomIn() },
        { label: 'Zoom Out', click: () => this.zoomOut() },
        { label: 'Reset Zoom', click: () => this.zoomReset() },
      );

      Menu.buildFromTemplate(items).popup();
    });
  }

  /**
   * Smart layout — only swaps views when the active tab actually changes.
   *
   * LAYOUT STRATEGY (eliminates GPU compositor desync):
   * - Sidebar BrowserView width = sidebarWidth + INSET
   *   (extends into the visual gap area; CSS padding-right creates the gap)
   * - Content BrowserView x = sidebarWidth + INSET
   *   (starts exactly where sidebar ends — ZERO gap between views)
   * - Content is inset from top/right/bottom window edges
   */
  private layoutViews(): void {
    const { width, height } = this.mainWindow.getContentBounds();
    const g = TabManager.CONTENT_INSET;

    // Sidebar extends INTO the gap area so there's no gap between views
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.sidebarWidth + g, height });

    const activeTab = this.getActiveTab();

    if (this.currentlyAttachedTabId !== this.activeTabId) {
      if (this.currentlyAttachedTabId) {
        const prevTab = this.findTab(this.currentlyAttachedTabId);
        if (prevTab) {
          try { this.mainWindow.contentView.removeChildView(prevTab.view); } catch { /* ok */ }
        }
      }
      if (activeTab) {
        // Insert at index 0 = bottom z-order (sidebar stays on top)
        this.mainWindow.contentView.addChildView(activeTab.view, 0);
      }
      this.currentlyAttachedTabId = this.activeTabId;
    }

    if (activeTab) {
      // Content starts RIGHT where sidebar ends — zero gap between BrowserViews
      activeTab.view.setBounds({
        x: this.sidebarWidth + g,
        y: g,
        width: width - this.sidebarWidth - g * 2,
        height: height - g * 2,
      });
      try { activeTab.view.setBorderRadius(TabManager.CONTENT_RADIUS); } catch { /* older Electron */ }
    }
  }

  /**
   * Layout with a custom sidebar width (resize IPC / CompactMode).
   *
   * Updates BOTH views in the same JS tick. Since sidebar extends into
   * the gap area and content starts right where sidebar ends (zero gap),
   * GPU compositor desync between frames is completely invisible.
   */
  layoutWithSidebarWidth(sidebarWidth: number): void {
    this.sidebarWidth = Math.max(
      CONFIG.SIDEBAR_MIN_WIDTH,
      Math.min(CONFIG.SIDEBAR_MAX_WIDTH, sidebarWidth),
    );
    const { width, height } = this.mainWindow.getContentBounds();
    const g = TabManager.CONTENT_INSET;

    // Both setBounds in same tick — and they share an edge, so no visible seam
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.sidebarWidth + g, height });

    const activeTab = this.getActiveTab();
    if (activeTab) {
      activeTab.view.setBounds({
        x: this.sidebarWidth + g,
        y: g,
        width: width - this.sidebarWidth - g * 2,
        height: height - g * 2,
      });
      try { activeTab.view.setBorderRadius(TabManager.CONTENT_RADIUS); } catch { /* older Electron */ }
    }
  }
}
