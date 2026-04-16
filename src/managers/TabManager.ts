import { BaseWindow, WebContentsView, Menu } from 'electron';
import { ManagedTab, TabData, SessionTab, CONFIG, IPC } from '../types';
import { AppDatabase } from '../database/Database';
import { DownloadManager } from './DownloadManager';
import { getNewTabPageUrl } from '../pages/newtab';

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

  createTab(url?: string, isPinned = false): ManagedTab {
    const id = this.nextId();
    const view = new WebContentsView();

    this.mainWindow.contentView.addChildView(view);
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
      zoomLevel: 1.0,
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
    try { this.mainWindow.contentView.removeChildView(tab.view); } catch { /* ok */ }

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
      }));
    this.database.saveSession(sessionTabs);
    console.log(`[Astra] 💾 Session saved: ${sessionTabs.length} tabs`);
  }

  restoreSession(): boolean {
    const sessionTabs = this.database.restoreSession();
    if (sessionTabs.length === 0) return false;

    for (const st of sessionTabs) {
      this.createTab(st.url, st.isPinned);
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

  /**
   * Send full tab state to sidebar.
   * Called directly only when explicitly requested (e.g. IPC.REQUEST_TABS).
   * For internal use, prefer `scheduleSend()` which throttles.
   */
  sendTabsToSidebar(): void {
    const tabData: TabData[] = this.tabs.map(t => ({
      id: t.id, title: t.title, url: t.url, favicon: t.favicon,
      isLoading: t.isLoading, isSecure: t.isSecure,
      isPinned: t.isPinned, zoomLevel: t.zoomLevel,
    }));
    this.sidebarView.webContents.send(IPC.TABS_UPDATED, {
      tabs: tabData,
      activeTabId: this.activeTabId,
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
          { label: 'Open Link in New Tab', click: () => {
            const t = this.createTab(params.linkURL);
            this.switchToTab(t.id);
          }},
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
   * Before: removeChildView(ALL tabs) + addChildView(active) = O(n) every time
   * After: removeChildView(previous) + addChildView(active) = O(1)
   */
  private layoutViews(): void {
    const { width, height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: CONFIG.SIDEBAR_WIDTH, height });

    const activeTab = this.getActiveTab();

    // Only swap if the active tab changed
    if (this.currentlyAttachedTabId !== this.activeTabId) {
      // Remove the previously attached tab
      if (this.currentlyAttachedTabId) {
        const prevTab = this.findTab(this.currentlyAttachedTabId);
        if (prevTab) {
          try { this.mainWindow.contentView.removeChildView(prevTab.view); } catch { /* ok */ }
        }
      }

      // Attach the new active tab
      if (activeTab) {
        this.mainWindow.contentView.addChildView(activeTab.view);
      }

      this.currentlyAttachedTabId = this.activeTabId;
    }

    // Always update bounds (for resize events)
    if (activeTab) {
      activeTab.view.setBounds({
        x: CONFIG.SIDEBAR_WIDTH, y: 0,
        width: width - CONFIG.SIDEBAR_WIDTH, height,
      });
    }
  }
}
