import { BaseWindow, WebContentsView, Menu } from 'electron';
import { ManagedTab, TabData, CONFIG, IPC } from '../types';
import { AppDatabase } from '../database/Database';
import { DownloadManager } from './DownloadManager';
import { getNewTabPageUrl } from '../pages/newtab';

/**
 * TabManager — owns the lifecycle of all browser tabs.
 *
 * Each tab is a separate WebContentsView (Chromium renderer process).
 * Only the active tab's view is attached to the window at any time;
 * inactive views are detached to avoid z-ordering issues.
 */
export class TabManager {
  private tabs: ManagedTab[] = [];
  private activeTabId: string | null = null;
  private tabCounter = 0;
  private onViewCreated: ((view: WebContentsView) => void) | null = null;
  private downloadManager: DownloadManager;

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

  setOnViewCreated(callback: (view: WebContentsView) => void): void {
    this.onViewCreated = callback;
  }

  /** Create a new tab. Pass no URL for the new tab page. */
  createTab(url?: string): ManagedTab {
    const id = this.nextId();
    const view = new WebContentsView();

    this.mainWindow.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    // Use new tab page if no URL provided
    const loadUrl = url || getNewTabPageUrl();
    view.webContents.loadURL(loadUrl);

    // Wire up events
    this.attachTabEvents(id, view);
    this.attachContextMenu(view);

    // Open links in new tab (target="_blank", middle-click)
    view.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
      const newTab = this.createTab(linkUrl);
      this.switchToTab(newTab.id);
      return { action: 'deny' };
    });

    // Attach download listener
    this.downloadManager.attachToView(view);

    const tab: ManagedTab = {
      id,
      view,
      title: 'New Tab',
      url: loadUrl,
      favicon: '🌐',
      isLoading: true,
      isSecure: false,
    };

    this.tabs.push(tab);
    this.onViewCreated?.(view);

    return tab;
  }

  switchToTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab) return;

    this.activeTabId = tabId;
    this.layoutViews();
    this.sidebarView.webContents.send(IPC.URL_CHANGED, tab.url);

    // Send bookmark status for the new active tab
    const isBookmarked = this.database.isBookmarked(tab.url);
    this.sidebarView.webContents.send(IPC.BOOKMARK_STATUS, isBookmarked);

    this.sendTabsToSidebar();
  }

  layout(): void {
    this.layoutViews();
  }

  closeTab(tabId: string): void {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tab = this.tabs[index];
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

  navigateActiveTab(url: string): void {
    const tab = this.getActiveTab();
    if (tab) tab.view.webContents.loadURL(url);
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
    const index = this.tabs.findIndex(t => t.id === this.activeTabId);
    this.switchToTab(this.tabs[(index + 1) % this.tabs.length].id);
  }

  previousTab(): void {
    if (this.tabs.length <= 1) return;
    const index = this.tabs.findIndex(t => t.id === this.activeTabId);
    this.switchToTab(this.tabs[(index - 1 + this.tabs.length) % this.tabs.length].id);
  }

  sendTabsToSidebar(): void {
    const tabData: TabData[] = this.tabs.map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      favicon: t.favicon,
      isLoading: t.isLoading,
      isSecure: t.isSecure,
    }));

    this.sidebarView.webContents.send(IPC.TABS_UPDATED, {
      tabs: tabData,
      activeTabId: this.activeTabId,
    });
  }

  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /** Get the active tab's URL (for bookmarking) */
  getActiveTabUrl(): string {
    return this.getActiveTab()?.url || '';
  }

  /** Get the active tab's title (for bookmarking) */
  getActiveTabTitle(): string {
    return this.getActiveTab()?.title || '';
  }

  getAllViews(): WebContentsView[] {
    return this.tabs.map(t => t.view);
  }

  // --------------------------------------------------
  // Private
  // --------------------------------------------------

  private nextId(): string {
    return `tab-${++this.tabCounter}`;
  }

  private findTab(id: string): ManagedTab | undefined {
    return this.tabs.find(t => t.id === id);
  }

  private getActiveTab(): ManagedTab | undefined {
    return this.activeTabId ? this.findTab(this.activeTabId) : undefined;
  }

  private attachTabEvents(id: string, view: WebContentsView): void {
    view.webContents.on('page-title-updated', (_event, title) => {
      const tab = this.findTab(id);
      if (tab) {
        tab.title = title;
        tab.url = view.webContents.getURL();

        // Record in history
        this.database.recordVisit(tab.url, title);

        this.sendTabsToSidebar();
      }
    });

    view.webContents.on('did-navigate', (_event, newUrl) => {
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

    view.webContents.on('did-navigate-in-page', (_event, newUrl) => {
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
  }

  private attachContextMenu(view: WebContentsView): void {
    view.webContents.on('context-menu', (_event, params) => {
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
