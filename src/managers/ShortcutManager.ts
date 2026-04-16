import { WebContentsView } from 'electron';
import { TabManager } from './TabManager';
import { AppDatabase } from '../database/Database';
import { IPC, CONFIG } from '../types';

type ShortcutHandler = (event: Electron.Event, input: Electron.Input) => void;

/**
 * ShortcutManager — handles all keyboard shortcuts.
 *
 * Shortcuts:
 *   Ctrl+T      → New tab
 *   Ctrl+W      → Close current tab
 *   Ctrl+Tab    → Next tab
 *   Ctrl+Shift+Tab → Previous tab
 *   Ctrl+L      → Focus URL bar
 *   Ctrl+R / F5 → Refresh
 *   Ctrl+D      → Toggle bookmark
 */
export class ShortcutManager {
  private readonly handler: ShortcutHandler;

  constructor(
    private readonly tabManager: TabManager,
    private readonly sidebarView: WebContentsView,
    private readonly database: AppDatabase,
  ) {
    this.handler = this.handleInput.bind(this);
  }

  initialize(): void {
    this.sidebarView.webContents.on('before-input-event', this.handler);

    for (const view of this.tabManager.getAllViews()) {
      this.attachToView(view);
    }

    this.tabManager.setOnViewCreated((view) => this.attachToView(view));
  }

  private attachToView(view: WebContentsView): void {
    view.webContents.on('before-input-event', this.handler);
  }

  private handleInput(event: Electron.Event, input: Electron.Input): void {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;

    if (ctrl && input.key === 't') {
      event.preventDefault();
      const tab = this.tabManager.createTab();
      this.tabManager.switchToTab(tab.id);
      return;
    }

    if (ctrl && input.key === 'w') {
      event.preventDefault();
      const id = this.tabManager.getActiveTabId();
      if (id) this.tabManager.closeTab(id);
      return;
    }

    if (ctrl && input.key === 'Tab' && !input.shift) {
      event.preventDefault();
      this.tabManager.nextTab();
      return;
    }

    if (ctrl && input.key === 'Tab' && input.shift) {
      event.preventDefault();
      this.tabManager.previousTab();
      return;
    }

    if (ctrl && input.key === 'l') {
      event.preventDefault();
      this.sidebarView.webContents.send(IPC.FOCUS_URL_BAR);
      return;
    }

    if ((ctrl && input.key === 'r') || input.key === 'F5') {
      event.preventDefault();
      this.tabManager.reload();
      return;
    }

    // Ctrl+D → Toggle bookmark
    if (ctrl && input.key === 'd') {
      event.preventDefault();
      const url = this.tabManager.getActiveTabUrl();
      const title = this.tabManager.getActiveTabTitle();
      if (!url || url.startsWith('data:') || url.startsWith('astra://')) return;

      if (this.database.isBookmarked(url)) {
        this.database.removeBookmark(url);
        this.sidebarView.webContents.send(IPC.BOOKMARK_STATUS, false);
      } else {
        this.database.addBookmark(url, title);
        this.sidebarView.webContents.send(IPC.BOOKMARK_STATUS, true);
      }
      return;
    }
  }
}
