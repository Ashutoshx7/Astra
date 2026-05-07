import { BaseWindow, WebContentsView, screen } from 'electron';

/**
 * CompactModeManager — Zen-style sidebar auto-hide.
 *
 * Architecture:
 * - When hidden, sidebar view shrinks to a thin 1px edge strip
 *   so content view fills the window and receives all clicks.
 * - Main process polls cursor position to detect edge hover
 *   (since the sidebar view is too thin for mouseenter to work).
 * - When cursor enters edge zone, sidebar view expands and
 *   renderer shows the sidebar via CSS.
 * - When cursor leaves, sidebar hides after a delay.
 */

export type CompactMode = 'expanded' | 'hidden';

const EDGE_ZONE = 6;         // px from window left edge to trigger reveal
const HIDE_DELAY_MS = 300;   // ms before hiding after cursor leaves
const POLL_INTERVAL_MS = 50; // cursor polling interval

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private sidebarOverlayVisible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private baseWidth = 300;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly layoutCallback: (sidebarWidth: number) => void,
  ) {}

  getMode(): CompactMode { return this.mode; }

  isSidebarVisible(): boolean {
    return this.mode === 'expanded' || this.sidebarOverlayVisible;
  }

  getSidebarWidth(): number {
    if (this.mode === 'expanded') return this.baseWidth;
    return this.sidebarOverlayVisible ? this.baseWidth : 0;
  }

  setBaseWidth(width: number): void { this.baseWidth = width; }
  getBaseWidth(): number { return this.baseWidth; }
  setResizing(_r: boolean): void {}

  /** Toggle expanded ↔ hidden */
  toggleMode(): void {
    if (this.mode === 'expanded') {
      this.mode = 'hidden';
      this.sidebarOverlayVisible = false;
      this.layoutHidden();
      this.startEdgePolling();
    } else {
      this.mode = 'expanded';
      this.sidebarOverlayVisible = false;
      this.stopEdgePolling();
      this.clearHideTimer();
      this.layoutExpanded();
    }
    this.notifyRenderer();
    console.log(`[Astra] 📐 Sidebar: ${this.mode}`);
  }

  setMode(mode: any): void {
    if (mode === 'expanded' || mode === 'full') {
      this.mode = 'expanded';
      this.sidebarOverlayVisible = false;
      this.stopEdgePolling();
      this.layoutExpanded();
    } else {
      this.mode = 'hidden';
      this.sidebarOverlayVisible = false;
      this.layoutHidden();
      this.startEdgePolling();
    }
    this.notifyRenderer();
  }

  // No-ops — hover handled by polling now
  handleMouseMove(_x: number, _y: number): void {}
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}

  // ── Edge hover polling ──

  private startEdgePolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => this.checkCursorEdge(), POLL_INTERVAL_MS);
  }

  private stopEdgePolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private checkCursorEdge(): void {
    if (this.mode === 'expanded') return;
    if (!this.mainWindow) return;

    try {
      const cursorPos = screen.getCursorScreenPoint();
      const winBounds = this.mainWindow.getBounds();

      // Cursor X relative to window left edge
      const relX = cursorPos.x - winBounds.x;
      // Cursor Y relative to window
      const relY = cursorPos.y - winBounds.y;

      // Only detect if cursor is within the window's vertical bounds
      const inWindow = relY >= 0 && relY <= winBounds.height;

      if (inWindow && relX >= 0 && relX <= EDGE_ZONE && !this.sidebarOverlayVisible) {
        // Cursor at left edge → show sidebar overlay
        this.clearHideTimer();
        this.showOverlay();
      } else if (this.sidebarOverlayVisible && relX > this.baseWidth) {
        // Cursor left sidebar area → start hide timer
        this.startHideTimer();
      } else if (this.sidebarOverlayVisible && relX <= this.baseWidth) {
        // Cursor inside sidebar → cancel hide
        this.clearHideTimer();
      }
    } catch {
      // screen API can fail if window is destroyed
    }
  }

  // ── Show/hide overlay ──

  private showOverlay(): void {
    if (this.sidebarOverlayVisible) return;
    this.sidebarOverlayVisible = true;

    // Expand sidebar view to full width (overlay on top of content)
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });

    this.notifyRenderer();
  }

  private hideOverlay(): void {
    if (!this.sidebarOverlayVisible) return;
    this.sidebarOverlayVisible = false;

    // Shrink sidebar view back to thin edge strip
    this.layoutHidden();
    this.notifyRenderer();
  }

  // ── Layout helpers ──

  private layoutExpanded(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
    this.layoutCallback(this.baseWidth);
  }

  private layoutHidden(): void {
    const { height } = this.mainWindow.getContentBounds();
    // Sidebar view = 1px thin strip at left edge for cursor detection
    this.sidebarView.setBounds({ x: 0, y: 0, width: 1, height });
    // Content fills full window
    this.layoutCallback(0);
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

  // ── Notify renderer ──

  private notifyRenderer(): void {
    this.sidebarView.webContents.send('compact:state', {
      mode: this.mode,
      expanded: this.mode === 'expanded',
      sidebarVisible: this.isSidebarVisible(),
      sidebarWidth: this.getSidebarWidth(),
    });
  }
}
