import { WebContentsView } from 'electron';
import { TabManager } from './TabManager';
import { IPC, CONFIG } from '../types';

type ShortcutHandler = (event: Electron.Event, input: Electron.Input) => void;

/**
 * ShortcutManager — handles all keyboard shortcuts.
 *
 * Listens for 'before-input-event' on both the sidebar and all web views.
 * New views are automatically registered via TabManager.setOnViewCreated().
 */
export class ShortcutManager {
  private readonly handler: ShortcutHandler;

  constructor(
    private readonly tabManager: TabManager,
    private readonly sidebarView: WebContentsView,
  ) {
    // Bind the handler once (avoids creating new functions per event)
    this.handler = this.handleInput.bind(this);
  }

  /** Start listening for shortcuts on the sidebar and all existing tab views */
  initialize(): void {
    this.sidebarView.webContents.on('before-input-event', this.handler);

    // Attach to existing tab views
    for (const view of this.tabManager.getAllViews()) {
      this.attachToView(view);
    }

    // Attach to future tab views
    this.tabManager.setOnViewCreated((view) => this.attachToView(view));
  }

  /** Attach shortcut listener to a specific WebContentsView */
  private attachToView(view: WebContentsView): void {
    view.webContents.on('before-input-event', this.handler);
  }

  /** Handle keyboard input and dispatch to the correct action */
  private handleInput(event: Electron.Event, input: Electron.Input): void {
    if (input.type !== 'keyDown') return;

    const ctrl = input.control || input.meta;

    if (ctrl && input.key === 't') {
      event.preventDefault();
      const tab = this.tabManager.createTab(CONFIG.DEFAULT_URL);
      this.tabManager.switchToTab(tab.id);
      return;
    }

    if (ctrl && input.key === 'w') {
      event.preventDefault();
      const activeId = this.tabManager.getActiveTabId();
      if (activeId) this.tabManager.closeTab(activeId);
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
  }
}
