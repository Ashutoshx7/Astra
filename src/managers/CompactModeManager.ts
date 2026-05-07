import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager — Zen-style sidebar auto-hide.
 *
 * Architecture:
 * - When hidden, sidebar view = thin edge strip (EDGE_WIDTH px)
 *   for mouseenter detection via IPC from renderer.
 * - Renderer detects mouseenter on that strip → sends IPC → main expands view.
 * - Renderer detects mouseleave → sends IPC → main shrinks view after delay.
 * - Works on Wayland (no screen.getCursorScreenPoint needed).
 */

export type CompactMode = 'expanded' | 'hidden';

const EDGE_WIDTH = 12;       // px - thin strip for hover detection
const HIDE_DELAY_MS = 300;   // ms before hiding after mouse leaves

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private overlayVisible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private baseWidth = 300;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly layoutCallback: (sidebarWidth: number) => void,
  ) {}

  getMode(): CompactMode { return this.mode; }

  isSidebarVisible(): boolean {
    return this.mode === 'expanded' || this.overlayVisible;
  }

  getSidebarWidth(): number {
    if (this.mode === 'expanded') return this.baseWidth;
    return this.overlayVisible ? this.baseWidth : 0;
  }

  setBaseWidth(width: number): void { this.baseWidth = width; }
  getBaseWidth(): number { return this.baseWidth; }
  setResizing(_r: boolean): void {}

  /** Toggle expanded ↔ hidden */
  toggleMode(): void {
    if (this.mode === 'expanded') {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.clearHideTimer();
      this.applyHiddenLayout();
    } else {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.clearHideTimer();
      this.applyExpandedLayout();
    }
    this.notifyRenderer();
    console.log(`[Astra] 📐 Sidebar: ${this.mode}`);
  }

  setMode(mode: any): void {
    if (mode === 'expanded' || mode === 'full') {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.applyExpandedLayout();
    } else {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.applyHiddenLayout();
    }
    this.notifyRenderer();
  }

  /** Called from renderer via IPC when mouse enters the edge strip */
  onEdgeEnter(): void {
    if (this.mode === 'expanded' || this.overlayVisible) return;
    this.clearHideTimer();
    this.overlayVisible = true;

    // Expand sidebar view to full width
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });

    this.notifyRenderer();
    console.log('[Astra] 📐 Sidebar: overlay shown (edge hover)');
  }

  /** Called from renderer via IPC when mouse leaves the sidebar */
  onEdgeLeave(): void {
    if (this.mode === 'expanded' || !this.overlayVisible) return;
    this.startHideTimer();
  }

  /** Cancel pending hide (mouse re-entered) */
  onEdgeCancelHide(): void {
    this.clearHideTimer();
  }

  // Legacy no-ops
  handleMouseMove(_x: number, _y: number): void {}
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}

  // ── Layout ──

  private applyExpandedLayout(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
    this.layoutCallback(this.baseWidth);
  }

  private applyHiddenLayout(): void {
    const { height } = this.mainWindow.getContentBounds();
    // Thin edge strip for mouseenter detection
    this.sidebarView.setBounds({ x: 0, y: 0, width: EDGE_WIDTH, height });
    // Content fills full window
    this.layoutCallback(0);
  }

  private hideOverlay(): void {
    if (!this.overlayVisible) return;
    this.overlayVisible = false;
    this.applyHiddenLayout();
    this.notifyRenderer();
    console.log('[Astra] 📐 Sidebar: overlay hidden');
  }

  // ── Timers ──

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      this.hideOverlay();
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  // ── IPC ──

  private notifyRenderer(): void {
    this.sidebarView.webContents.send('compact:state', {
      mode: this.mode,
      expanded: this.mode === 'expanded',
      sidebarVisible: this.isSidebarVisible(),
      sidebarWidth: this.getSidebarWidth(),
    });
  }
}
