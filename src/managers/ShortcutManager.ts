import { WebContentsView, clipboard } from 'electron';
import { TabManager } from './TabManager';
import { AppDatabase } from '../database/Database';
import { IPC } from '../types';
import type { SpaceManager } from './SpaceManager';
import type { CompactModeManager } from './CompactModeManager';
import type { GlanceManager } from './GlanceManager';
import type { SplitViewManager } from './SplitViewManager';

type ShortcutHandler = (event: Electron.Event, input: Electron.Input) => void;

/**
 * ShortcutManager — all keyboard shortcuts.
 *
 * Shortcuts:
 *   Ctrl+T            → New tab
 *   Ctrl+W            → Close current tab
 *   Ctrl+Tab           → Next tab
 *   Ctrl+Shift+Tab     → Previous tab
 *   Ctrl+L            → Focus URL bar
 *   Ctrl+R / F5       → Refresh
 *   Ctrl+D            → Toggle bookmark
 *   Ctrl+F            → Find in page
 *   Ctrl+= / Ctrl++   → Zoom in
 *   Ctrl+-            → Zoom out
 *   Ctrl+0            → Reset zoom
 *   F11               → Toggle fullscreen
 *   Escape            → Stop find / exit fullscreen
 */
export class ShortcutManager {
  private readonly handler: ShortcutHandler;
  private spaceManager: SpaceManager | null = null;
  private compactMode: CompactModeManager | null = null;
  private glanceManager: GlanceManager | null = null;
  private splitView: SplitViewManager | null = null;

  constructor(
    private readonly tabManager: TabManager,
    private readonly sidebarView: WebContentsView,
    private readonly database: AppDatabase,
    private readonly getMainWindow: () => Electron.BaseWindow | null,
  ) {
    this.handler = this.handleInput.bind(this);
  }

  setSpaceManager(sm: SpaceManager): void {
    this.spaceManager = sm;
  }

  setCompactMode(cm: CompactModeManager): void {
    this.compactMode = cm;
  }

  setGlanceManager(gm: GlanceManager): void {
    this.glanceManager = gm;
  }

  setSplitView(sv: SplitViewManager): void {
    this.splitView = sv;
  }

  initialize(): void {
    this.sidebarView.webContents.on('before-input-event', this.handler);
    for (const view of this.tabManager.getAllViews()) {
      this.attachToView(view);
    }
    // Note: onViewCreated is now set in main.ts to also inject FingerprintGuard
  }

  attachToView(view: WebContentsView): void {
    view.webContents.on('before-input-event', this.handler);
  }

  private handleInput(event: Electron.Event, input: Electron.Input): void {
    if (input.type !== 'keyDown') return;
    const ctrl = input.control || input.meta;

    // Ctrl+T → New tab
    if (ctrl && input.key === 't') {
      event.preventDefault();
      const tab = this.tabManager.createTab();
      this.tabManager.switchToTab(tab.id);
      return;
    }

    // Ctrl+W → Close tab
    if (ctrl && input.key === 'w') {
      event.preventDefault();
      const id = this.tabManager.getActiveTabId();
      if (id) this.tabManager.closeTab(id);
      return;
    }

    // Ctrl+Tab → Next tab
    if (ctrl && input.key === 'Tab' && !input.shift) {
      event.preventDefault();
      this.tabManager.nextTab();
      return;
    }

    // Ctrl+Shift+Tab → Previous tab
    if (ctrl && input.key === 'Tab' && input.shift) {
      event.preventDefault();
      this.tabManager.previousTab();
      return;
    }

    // Ctrl+L → Focus URL bar
    if (ctrl && input.key === 'l') {
      event.preventDefault();
      this.sidebarView.webContents.send(IPC.FOCUS_URL_BAR);
      return;
    }

    // Ctrl+R / F5 → Refresh
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

    // Ctrl+F → Find in page
    if (ctrl && input.key === 'f') {
      event.preventDefault();
      this.sidebarView.webContents.send(IPC.SHOW_FIND_BAR);
      return;
    }

    // Ctrl+= or Ctrl++ → Zoom in
    if (ctrl && (input.key === '=' || input.key === '+')) {
      event.preventDefault();
      this.tabManager.zoomIn();
      return;
    }

    // Ctrl+- → Zoom out
    if (ctrl && input.key === '-') {
      event.preventDefault();
      this.tabManager.zoomOut();
      return;
    }

    // Ctrl+0 → Reset zoom
    if (ctrl && input.key === '0') {
      event.preventDefault();
      this.tabManager.zoomReset();
      return;
    }

    // F11 → Toggle fullscreen
    if (input.key === 'F11') {
      event.preventDefault();
      const win = this.getMainWindow();
      if (win) win.setFullScreen(!win.isFullScreen());
      return;
    }

    // Escape — Stop find / exit fullscreen / close glance
    if (input.key === 'Escape') {
      // Close glance first if active
      if (this.glanceManager?.isActive()) {
        event.preventDefault();
        this.glanceManager.close();
        return;
      }
      this.tabManager.stopFind();
      this.sidebarView.webContents.send(IPC.FIND_RESULT, null);
      const win = this.getMainWindow();
      if (win?.isFullScreen()) win.setFullScreen(false);
      return;
    }

    // Ctrl+S — Toggle compact mode (Zen's sidebar toggle shortcut)
    if (ctrl && input.key === 's') {
      event.preventDefault();
      this.compactMode?.toggleMode();
      return;
    }

    // Ctrl+Shift+C — Copy page URL (Helium shortcut remap)
    if (ctrl && input.shift && input.key === 'C') {
      event.preventDefault();
      const url = this.tabManager.getActiveTabUrl();
      if (url) {
        clipboard.writeText(url);
        // Flash a brief notification to sidebar
        this.sidebarView.webContents.send('url-copied', url);
      }
      return;
    }

    // Ctrl+Alt+Right — Next workspace (Zen shortcut)
    if (ctrl && input.alt && input.key === 'ArrowRight') {
      event.preventDefault();
      this.spaceManager?.switchToNextSpace();
      return;
    }

    // Ctrl+Alt+Left — Previous workspace (Zen shortcut)
    if (ctrl && input.alt && input.key === 'ArrowLeft') {
      event.preventDefault();
      this.spaceManager?.switchToPreviousSpace();
      return;
    }

    // Ctrl+Shift+S — Toggle split view
    if (ctrl && input.shift && input.key === 'S') {
      event.preventDefault();
      if (this.splitView?.isActive()) {
        this.splitView.unsplit();
      } else {
        const activeId = this.tabManager.getActiveTabId();
        if (activeId) this.splitView?.split(activeId);
      }
      return;
    }
  }
}
