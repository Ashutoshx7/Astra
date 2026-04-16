import { BaseWindow, WebContentsView, Menu } from 'electron';
import { ManagedTab, TabData, CONFIG, IPC } from '../types';

/**
 * TabManager — owns the lifecycle of all browser tabs.
 *
 * Each tab is a separate WebContentsView (Chromium renderer process).
 * Only the active tab's view is attached to the window at any time;
 * inactive views are detached to avoid z-ordering issues.
 *
 * This class is the single source of truth for tab state.
 */
export class TabManager {
  private tabs: ManagedTab[] = [];
  private activeTabId: string | null = null;
  private tabCounter = 0;
  private onViewCreated: ((view: WebContentsView) => void) | null = null;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
  ) {}

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  /** Register a callback invoked when a new tab's view is created (for keyboard shortcuts) */
  setOnViewCreated(callback: (view: WebContentsView) => void): void {
    this.onViewCreated = callback;
  }

  /** Create a new tab and return it. Does NOT switch to it. */
  createTab(url: string = CONFIG.DEFAULT_URL): ManagedTab {
    const id = this.nextId();
    const view = new WebContentsView();

    // Add to window but hide (will be shown if switched to)
    this.mainWindow.contentView.addChildView(view);
    view.setBounds({ x: 0, y: 0, width: 0, height: 0 });

    // Load the page
    view.webContents.loadURL(url);

    // Wire up event listeners
    this.attachTabEvents(id, view);
    this.attachContextMenu(view);

    // Handle target="_blank" and middle-click → open in new tab
    view.webContents.setWindowOpenHandler(({ url: linkUrl }) => {
      const newTab = this.createTab(linkUrl);
      this.switchToTab(newTab.id);
      return { action: 'deny' };
    });

    const tab: ManagedTab = {
      id,
      view,
      title: 'New Tab',
      url,
      favicon: '🌐',
      isLoading: true,
    };

    this.tabs.push(tab);

    // Notify external listeners (shortcut manager)
    this.onViewCreated?.(view);

    return tab;
  }

  /** Switch the active tab. Updates layout and notifies sidebar. */
  switchToTab(tabId: string): void {
    const tab = this.findTab(tabId);
    if (!tab) return;

    this.activeTabId = tabId;
    this.layoutViews();
    this.sidebarView.webContents.send(IPC.URL_CHANGED, tab.url);
    this.sendTabsToSidebar();
  }

  /** Re-layout views without switching tabs (e.g. on window resize) */
  layout(): void {
    this.layoutViews();
  }

  /** Close a tab. If it's the active tab, switch to the nearest neighbor. */
  closeTab(tabId: string): void {
    const index = this.tabs.findIndex(t => t.id === tabId);
    if (index === -1) return;

    const tab = this.tabs[index];

    // Detach and destroy
    try { this.mainWindow.contentView.removeChildView(tab.view); } catch { /* already removed */ }
    tab.view.webContents.close();
    this.tabs.splice(index, 1);

    // Switch to neighbor if we closed the active tab
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

  /** Navigate the active tab to a URL. */
  navigateActiveTab(url: string): void {
    const tab = this.getActiveTab();
    if (tab) {
      tab.view.webContents.loadURL(url);
    }
  }

  /** Go back in the active tab's history. */
  goBack(): void {
    const tab = this.getActiveTab();
    if (tab?.view.webContents.navigationHistory.canGoBack()) {
      tab.view.webContents.navigationHistory.goBack();
    }
  }

  /** Go forward in the active tab's history. */
  goForward(): void {
    const tab = this.getActiveTab();
    if (tab?.view.webContents.navigationHistory.canGoForward()) {
      tab.view.webContents.navigationHistory.goForward();
    }
  }

  /** Reload the active tab. */
  reload(): void {
    this.getActiveTab()?.view.webContents.reload();
  }

  /** Switch to the next tab (wraps around). */
  nextTab(): void {
    if (this.tabs.length <= 1) return;
    const index = this.tabs.findIndex(t => t.id === this.activeTabId);
    const nextIndex = (index + 1) % this.tabs.length;
    this.switchToTab(this.tabs[nextIndex].id);
  }

  /** Switch to the previous tab (wraps around). */
  previousTab(): void {
    if (this.tabs.length <= 1) return;
    const index = this.tabs.findIndex(t => t.id === this.activeTabId);
    const prevIndex = (index - 1 + this.tabs.length) % this.tabs.length;
    this.switchToTab(this.tabs[prevIndex].id);
  }

  /** Send the current tab list to the sidebar. */
  sendTabsToSidebar(): void {
    const tabData: TabData[] = this.tabs.map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      favicon: t.favicon,
      isLoading: t.isLoading,
    }));

    this.sidebarView.webContents.send(IPC.TABS_UPDATED, {
      tabs: tabData,
      activeTabId: this.activeTabId,
    });
  }

  /** Get the active tab's ID. */
  getActiveTabId(): string | null {
    return this.activeTabId;
  }

  /** Get all tab views (for attaching shortcuts to existing tabs). */
  getAllViews(): WebContentsView[] {
    return this.tabs.map(t => t.view);
  }

  // --------------------------------------------------
  // Private helpers
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

  /** Attach page lifecycle events to a tab's WebContentsView */
  private attachTabEvents(id: string, view: WebContentsView): void {
    view.webContents.on('page-title-updated', (_event, title) => {
      const tab = this.findTab(id);
      if (tab) {
        tab.title = title;
        tab.url = view.webContents.getURL();
        this.sendTabsToSidebar();
      }
    });

    view.webContents.on('did-navigate', (_event, newUrl) => {
      const tab = this.findTab(id);
      if (tab) {
        tab.url = newUrl;
        this.sendTabsToSidebar();
      }
      if (id === this.activeTabId) {
        this.sidebarView.webContents.send(IPC.URL_CHANGED, newUrl);
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
      if (tab) {
        tab.isLoading = true;
        this.sendTabsToSidebar();
      }
    });

    view.webContents.on('did-stop-loading', () => {
      const tab = this.findTab(id);
      if (tab) {
        tab.isLoading = false;
        this.sendTabsToSidebar();
      }
    });
  }

  /** Attach right-click context menu to a tab's WebContentsView */
  private attachContextMenu(view: WebContentsView): void {
    view.webContents.on('context-menu', (_event, params) => {
      const menuItems: Electron.MenuItemConstructorOptions[] = [];

      if (params.linkURL) {
        menuItems.push(
          {
            label: 'Open Link in New Tab',
            click: () => {
              const newTab = this.createTab(params.linkURL);
              this.switchToTab(newTab.id);
            },
          },
          {
            label: 'Copy Link Address',
            click: () => require('electron').clipboard.writeText(params.linkURL),
          },
          { type: 'separator' },
        );
      }

      if (params.selectionText) {
        menuItems.push(
          { label: 'Copy', role: 'copy' },
          { type: 'separator' },
        );
      }

      menuItems.push(
        {
          label: 'Back',
          enabled: view.webContents.navigationHistory.canGoBack(),
          click: () => view.webContents.navigationHistory.goBack(),
        },
        {
          label: 'Forward',
          enabled: view.webContents.navigationHistory.canGoForward(),
          click: () => view.webContents.navigationHistory.goForward(),
        },
        { label: 'Reload', click: () => view.webContents.reload() },
      );

      Menu.buildFromTemplate(menuItems).popup();
    });
  }

  /** Position views — sidebar on left, active tab on right, others detached */
  private layoutViews(): void {
    const { width, height } = this.mainWindow.getContentBounds();

    this.sidebarView.setBounds({ x: 0, y: 0, width: CONFIG.SIDEBAR_WIDTH, height });

    // Detach all tab views
    for (const tab of this.tabs) {
      try { this.mainWindow.contentView.removeChildView(tab.view); } catch { /* not attached */ }
    }

    // Attach only the active tab
    const activeTab = this.getActiveTab();
    if (activeTab) {
      this.mainWindow.contentView.addChildView(activeTab.view);
      activeTab.view.setBounds({
        x: CONFIG.SIDEBAR_WIDTH,
        y: 0,
        width: width - CONFIG.SIDEBAR_WIDTH,
        height,
      });
    }
  }
}
