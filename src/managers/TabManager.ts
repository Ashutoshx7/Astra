import { BaseWindow, WebContentsView, Menu } from 'electron';
import { ManagedTab, TabData, SessionTab, CONFIG, IPC } from '../types';
import { AppDatabase } from '../database/Database';
import { DownloadManager } from './DownloadManager';
import { getNewTabPageUrl } from '../pages/newtab';

/**
 * TabManager — owns the lifecycle of all browser tabs.
 *
 * Features:
 *   - Create/switch/close tabs
 *   - Session restore (save/restore from SQLite)
 *   - Tab pinning (pinned tabs can't be closed)
 *   - Zoom per-tab
 *   - Find in page
 *   - Favicon fetching
 *   - Context menus
 *   - Download tracking
 */
export class TabManager {
  private tabs: ManagedTab[] = [];
  private activeTabId: string | null = null;
  private tabCounter = 0;
  private onViewCreated: ((view: WebContentsView) => void) | null = null;
  private readonly downloadManager: DownloadManager;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly database: AppDatabase,
  ) {
    this.downloadManager = new DownloadManager(sidebarView);
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

    const loadUrl = url || getNewTabPageUrl();
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
      id,
      view,
      title: 'New Tab',
      url: loadUrl,
      favicon: '🌐',
      isLoading: true,
      isSecure: false,
      isPinned,
      zoomLevel: 1.0,
    };

    // Insert pinned tabs at the start, regular tabs after pinned ones
    if (isPinned) {
      const firstUnpinned = this.tabs.findIndex(t => !t.isPinned);
      if (firstUnpinned === -1) {
        this.tabs.push(tab);
      } else {
        this.tabs.splice(firstUnpinned, 0, tab);
      }
    } else {
      this.tabs.push(tab);
    }

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
    this.sendTabsToSidebar();
  }

  layout(): void {
    this.layoutViews();
  }

  closeTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab) return;

    // Pinned tabs can't be closed
    if (tab.isPinned) return;

    const index = this.tabs.indexOf(tab);
    try { this.mainWindow.contentView.removeChildView(tab.view); } catch { /* ok */ }
    tab.view.webContents.close();
    this.tabs.splice(index, 1);

    if (this.activeTabId === tabId) {
      if (this.tabs.length > 0) {
        const newIndex = Math.min(index, this.tabs.length - 1);
        this.switchToTab(this.tabs[newIndex].id);
      } else {
        const newTab = this.createTab();
        this.switchToTab(newTab.id);
      }
    }

    this.sendTabsToSidebar();
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

    // Move to pinned section (start of array)
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    const firstUnpinned = this.tabs.findIndex(t => !t.isPinned);
    if (firstUnpinned === -1) {
      this.tabs.push(tab);
    } else {
      this.tabs.splice(firstUnpinned, 0, tab);
    }

    this.sendTabsToSidebar();
  }

  unpinTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab || !tab.isPinned) return;

    tab.isPinned = false;

    // Move after pinned section
    const index = this.tabs.indexOf(tab);
    this.tabs.splice(index, 1);
    const firstUnpinned = this.tabs.findIndex(t => !t.isPinned);
    if (firstUnpinned === -1) {
      this.tabs.push(tab);
    } else {
      this.tabs.splice(firstUnpinned, 0, tab);
    }

    this.sendTabsToSidebar();
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

  findNext(): void {
    const tab = this.getActiveTab();
    if (!tab) return;
    // Find next is triggered by calling findInPage again with same text
    // The actual "find next" needs the text, handled via IPC from sidebar
  }

  stopFind(): void {
    this.getActiveTab()?.view.webContents.stopFindInPage('clearSelection');
  }

  // --------------------------------------------------
  // Session restore
  // --------------------------------------------------

  /** Save current tabs to database for next launch */
  saveSession(): void {
    const sessionTabs: SessionTab[] = this.tabs
      .filter(t => !t.url.startsWith('data:') && !t.url.startsWith('astra://'))
      .map((t, i) => ({
        url: t.url,
        title: t.title,
        isPinned: t.isPinned,
        position: i,
      }));

    this.database.saveSession(sessionTabs);
    console.log(`[Astra] 💾 Session saved: ${sessionTabs.length} tabs`);
  }

  /** Restore tabs from previous session */
  restoreSession(): boolean {
    const sessionTabs = this.database.restoreSession();
    if (sessionTabs.length === 0) return false;

    for (const st of sessionTabs) {
      this.createTab(st.url, st.isPinned);
    }

    // Switch to the first tab
    if (this.tabs.length > 0) {
      this.switchToTab(this.tabs[0].id);
    }

    console.log(`[Astra] 🔄 Session restored: ${sessionTabs.length} tabs`);
    return true;
  }

  // --------------------------------------------------
  // State getters
  // --------------------------------------------------

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
  }

  getActiveTabId(): string | null { return this.activeTabId; }
  getActiveTabUrl(): string { return this.getActiveTab()?.url || ''; }
  getActiveTabTitle(): string { return this.getActiveTab()?.title || ''; }
  getAllViews(): WebContentsView[] { return this.tabs.map(t => t.view); }

  // --------------------------------------------------
  // Private
  // --------------------------------------------------

  private nextId(): string { return `tab-${++this.tabCounter}`; }
  private findTab(id: string): ManagedTab | undefined { return this.tabs.find(t => t.id === id); }
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
        this.sendTabsToSidebar();
      }
    });

    // Favicon fetching
    view.webContents.on('page-favicon-updated', (_e, favicons) => {
      const tab = this.findTab(id);
      if (tab && favicons.length > 0) {
        tab.favicon = favicons[0]; // URL to the favicon image
        this.sendTabsToSidebar();
      }
    });

    view.webContents.on('did-navigate', (_e, newUrl) => {
      const tab = this.findTab(id);
      if (tab) {
        tab.url = newUrl;
        tab.isSecure = newUrl.startsWith('https://');
        this.sendTabsToSidebar();
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
      if (tab) { tab.isLoading = true; this.sendTabsToSidebar(); }
    });

    view.webContents.on('did-stop-loading', () => {
      const tab = this.findTab(id);
      if (tab) { tab.isLoading = false; this.sendTabsToSidebar(); }
    });

    // Find-in-page results
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

  private layoutViews(): void {
    const { width, height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: CONFIG.SIDEBAR_WIDTH, height });

    for (const tab of this.tabs) {
      try { this.mainWindow.contentView.removeChildView(tab.view); } catch { /* ok */ }
    }

    const activeTab = this.getActiveTab();
    if (activeTab) {
      this.mainWindow.contentView.addChildView(activeTab.view);
      activeTab.view.setBounds({
        x: CONFIG.SIDEBAR_WIDTH, y: 0,
        width: width - CONFIG.SIDEBAR_WIDTH, height,
      });
    }
  }
}
