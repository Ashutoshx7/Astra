import { BaseWindow, WebContentsView } from 'electron';
import { IPC } from '../types';

/**
 * CompactModeManager — Zen-style sidebar expand/collapse.
 *
 * Zen's behavior:
 *   - Expanded: full width sidebar with labels, icons, tabs
 *   - Collapsed: icon-only, ~60px wide, no labels
 *   - Toggle via sidebar button or Ctrl+S
 *   - Smooth transition
 */

export type CompactMode = 'expanded' | 'collapsed';

const COLLAPSED_WIDTH = 60; // Zen: 48px + 6px*2 padding

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private baseWidth = 300; // Full sidebar width

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly layoutCallback: (sidebarWidth: number) => void,
  ) {}

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  getMode(): CompactMode {
    return this.mode;
  }

  isExpanded(): boolean {
    return this.mode === 'expanded';
  }

  getSidebarWidth(): number {
    return this.mode === 'expanded' ? this.baseWidth : COLLAPSED_WIDTH;
  }

  /** Update base width when sidebar is resized */
  setBaseWidth(width: number): void {
    this.baseWidth = width;
  }

  /** Call before sidebar drag starts */
  setResizing(resizing: boolean): void {
    // no-op for now
  }

  /** Toggle between expanded and collapsed (Zen Ctrl+S) */
  toggleMode(): void {
    this.setMode(this.mode === 'expanded' ? 'collapsed' : 'expanded');
  }

  setMode(mode: CompactMode): void {
    this.mode = mode;
    this.updateLayout();
    this.notifySidebar();
    console.log(`[Astra] 📐 Sidebar: ${mode} (${this.getSidebarWidth()}px)`);
  }

  /** Keep backward compat */
  isSidebarVisible(): boolean {
    return true; // Always visible — just different widths
  }

  // Flash / popup lock — no-ops since sidebar never fully hides
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}
  handleMouseMove(_x: number, _y: number): void {}

  // --------------------------------------------------
  // Private
  // --------------------------------------------------

  private updateLayout(): void {
    const width = this.getSidebarWidth();
    this.layoutCallback(width);
  }

  private notifySidebar(): void {
    this.sidebarView.webContents.send('compact:state', {
      mode: this.mode,
      expanded: this.mode === 'expanded',
      sidebarWidth: this.getSidebarWidth(),
    });
  }
}
