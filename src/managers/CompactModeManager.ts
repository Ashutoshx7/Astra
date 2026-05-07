import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - sidebar auto-hide with smooth overlay.
 *
 * Approach:
 * - Hidden: sidebar view = thin 12px strip (catches mouseenter).
 *   Background is transparent so it doesn't block content visually.
 * - Overlay: sidebar view expands to full width (still transparent bg).
 *   No flash because bg is transparent. CSS handles the visual slide-in.
 *   Sidebar brought to front so it overlays content.
 * - Expanded: sidebar view at normal width with solid bg, behind content.
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = '#1b1b1b';
const TRANSPARENT = '#00000000';
const EDGE_WIDTH = 12;
const HIDE_DELAY_MS = 300;
const ANIM_DURATION_MS = 220;

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private overlayVisible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;
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

  /** Toggle expanded <-> hidden */
  toggleMode(): void {
    this.clearAllTimers();

    if (this.mode === 'expanded') {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        // Make transparent, shrink to edge strip
        this.sidebarView.setBackgroundColor(TRANSPARENT);
        this.shrinkToEdge();
        this.sidebarToFront(); // on top but tiny + transparent
        this.layoutCallback(0);
        this.sendState();
      }, ANIM_DURATION_MS);

    } else {
      this.mode = 'expanded';
      this.overlayVisible = false;
      // Restore solid bg, normal layout
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.sidebarToBack();
      this.expandView();
      this.layoutCallback(this.baseWidth);
      this.sendState('showing');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.sendState();
      }, ANIM_DURATION_MS);
    }
    console.log(`[Astra] sidebar: ${this.mode}`);
  }

  setMode(mode: any): void {
    this.clearAllTimers();
    if (mode === 'expanded' || mode === 'full') {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.sidebarToBack();
      this.expandView();
      this.layoutCallback(this.baseWidth);
    } else {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(TRANSPARENT);
      this.shrinkToEdge();
      this.sidebarToFront();
      this.layoutCallback(0);
    }
    this.sendState();
  }

  /** Mouse entered the edge strip */
  onEdgeEnter(): void {
    if (this.mode === 'expanded' || this.overlayVisible) return;
    this.clearAllTimers();
    this.overlayVisible = true;

    // Expand view (still transparent bg, no flash)
    this.expandView();
    // Already on top from enterHiddenMode

    this.sendState('showing');

    this.animTimer = setTimeout(() => {
      this.animTimer = null;
      this.sendState();
    }, ANIM_DURATION_MS);

    console.log('[Astra] sidebar: overlay');
  }

  /** Mouse left sidebar */
  onEdgeLeave(): void {
    if (this.mode === 'expanded' || !this.overlayVisible) return;
    this.startHideTimer();
  }

  onEdgeCancelHide(): void {
    this.clearHideTimer();
  }

  // Legacy no-ops
  handleMouseMove(_x: number, _y: number): void {}
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}

  // -- View bounds --

  private expandView(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
  }

  private shrinkToEdge(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: EDGE_WIDTH, height });
  }

  // -- Z-order --

  private sidebarToFront(): void {
    try {
      const parent = this.mainWindow.contentView;
      parent.removeChildView(this.sidebarView);
      parent.addChildView(this.sidebarView);
    } catch {}
  }

  private sidebarToBack(): void {
    try {
      const parent = this.mainWindow.contentView;
      parent.removeChildView(this.sidebarView);
      parent.addChildView(this.sidebarView, 0);
    } catch {}
  }

  // -- Timers --

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.overlayVisible) return;

      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.overlayVisible = false;
        this.shrinkToEdge();
        this.sendState();
      }, ANIM_DURATION_MS);
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  private clearAllTimers(): void {
    this.clearHideTimer();
    if (this.animTimer) { clearTimeout(this.animTimer); this.animTimer = null; }
  }

  // -- IPC --

  private sendState(animating?: 'hiding' | 'showing'): void {
    this.sidebarView.webContents.send('compact:state', {
      mode: this.mode,
      expanded: this.mode === 'expanded',
      sidebarVisible: this.isSidebarVisible(),
      sidebarWidth: this.getSidebarWidth(),
      animating: animating || null,
    });
  }
}
