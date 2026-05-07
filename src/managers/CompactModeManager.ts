import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager — Zen-style sidebar auto-hide.
 *
 * Toggle: sidebar fully hides (width 0)
 * Hover left edge: sidebar slides in as overlay
 * Mouse leaves: sidebar slides back out
 * Toggle again: sidebar stays permanently visible
 */

export type CompactMode = 'expanded' | 'hidden';

const EDGE_ZONE = 12;        // px from left edge to trigger reveal
const HIDE_DELAY_MS = 250;   // ms before hiding after mouse leaves

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private sidebarVisible = true;
  private hoverLocked = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private baseWidth = 300;
  private lastMouseX = 0;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly layoutCallback: (sidebarWidth: number) => void,
  ) {}

  getMode(): CompactMode { return this.mode; }

  getSidebarWidth(): number {
    return this.sidebarVisible ? this.baseWidth : 0;
  }

  isSidebarVisible(): boolean {
    return this.sidebarVisible;
  }

  setBaseWidth(width: number): void {
    this.baseWidth = width;
  }

  getBaseWidth(): number {
    return this.baseWidth;
  }

  setResizing(resizing: boolean): void {}

  /** Toggle: expanded ↔ hidden */
  toggleMode(): void {
    if (this.mode === 'expanded') {
      this.mode = 'hidden';
      this.hideSidebar();
    } else {
      this.mode = 'expanded';
      this.showSidebar();
      this.hoverLocked = false;
    }
    this.notifyRenderer();
    console.log(`[Astra] 📐 Sidebar: ${this.mode}`);
  }

  setMode(mode: any): void {
    if (mode === 'expanded' || mode === 'full') {
      this.mode = 'expanded';
      this.showSidebar();
    } else {
      this.mode = 'hidden';
      this.hideSidebar();
    }
    this.notifyRenderer();
  }

  /** Handle mouse from renderer — left-edge hover reveal */
  handleMouseMove(x: number, _y: number): void {
    this.lastMouseX = x;
    if (this.mode === 'expanded') return;

    // Mouse hit left edge → show sidebar overlay
    if (x <= EDGE_ZONE && !this.sidebarVisible) {
      this.clearHideTimer();
      this.showSidebar();
      this.hoverLocked = true;
      return;
    }

    // Mouse left sidebar area → start hide timer
    if (x > this.baseWidth && this.sidebarVisible && this.hoverLocked) {
      this.startHideTimer();
    }

    // Mouse re-entered sidebar → cancel hide
    if (x <= this.baseWidth && this.hoverLocked) {
      this.clearHideTimer();
    }
  }

  flashSidebar(): void {
    if (this.mode === 'expanded' || this.sidebarVisible) return;
    this.showSidebar();
    setTimeout(() => {
      if (this.lastMouseX > this.baseWidth) this.hideSidebar();
    }, 800);
  }

  lockForPopup(): void {
    this.clearHideTimer();
    this.hoverLocked = true;
    if (!this.sidebarVisible && this.mode !== 'expanded') this.showSidebar();
  }

  unlockFromPopup(): void {
    this.hoverLocked = false;
    if (this.mode !== 'expanded' && this.lastMouseX > this.baseWidth) {
      this.startHideTimer();
    }
  }

  // ── Private ──

  private showSidebar(): void {
    if (this.sidebarVisible) return;
    this.sidebarVisible = true;
    this.updateLayout();
    this.notifyRenderer();
  }

  private hideSidebar(): void {
    if (!this.sidebarVisible) return;
    this.sidebarVisible = false;
    this.hoverLocked = false;
    this.updateLayout();
    this.notifyRenderer();
  }

  private updateLayout(): void {
    const width = this.getSidebarWidth();
    this.layoutCallback(width);
  }

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hideSidebar();
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private notifyRenderer(): void {
    this.sidebarView.webContents.send('compact:state', {
      mode: this.mode,
      expanded: this.mode === 'expanded',
      sidebarVisible: this.sidebarVisible,
      sidebarWidth: this.getSidebarWidth(),
    });
  }
}
