import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - sidebar auto-hide with smooth transitions.
 *
 * The sidebar overlays ON TOP of content (like Zen).
 * Content never moves during overlay - only during toggle.
 *
 * Z-order management:
 * - Normal: sidebar behind content (added first)
 * - Overlay: sidebar brought to front via re-adding to contentView
 */

export type CompactMode = 'expanded' | 'hidden';

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
      // HIDE: animate out, then shrink view + move content
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.shrinkView();
        this.layoutCallback(0); // content fills window
        this.sendState();
      }, ANIM_DURATION_MS);

    } else {
      // SHOW: expand view + move content, then animate in
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarToBack(); // normal z-order
      this.expandView();
      this.layoutCallback(this.baseWidth); // content adjusts
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
      this.sidebarToBack();
      this.expandView();
      this.layoutCallback(this.baseWidth);
    } else {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.shrinkView();
      this.layoutCallback(0);
    }
    this.sendState();
  }

  /** Mouse entered edge strip - show overlay ON TOP of content */
  onEdgeEnter(): void {
    if (this.mode === 'expanded' || this.overlayVisible) return;
    this.clearAllTimers();
    this.overlayVisible = true;

    // Bring sidebar to front so it overlays content
    this.sidebarToFront();
    this.expandView();
    // Do NOT call layoutCallback - content stays at full width

    this.sendState('showing');

    this.animTimer = setTimeout(() => {
      this.animTimer = null;
      this.sendState();
    }, ANIM_DURATION_MS);

    console.log('[Astra] sidebar: overlay');
  }

  /** Mouse left sidebar - start hide timer */
  onEdgeLeave(): void {
    if (this.mode === 'expanded' || !this.overlayVisible) return;
    this.startHideTimer();
  }

  /** Cancel pending hide */
  onEdgeCancelHide(): void {
    this.clearHideTimer();
  }

  // Legacy no-ops
  handleMouseMove(_x: number, _y: number): void {}
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}

  // -- Z-order management --

  private sidebarToFront(): void {
    try {
      const parent = this.mainWindow.contentView;
      parent.removeChildView(this.sidebarView);
      parent.addChildView(this.sidebarView); // adds to end = top
    } catch { /* view might already be removed */ }
  }

  private sidebarToBack(): void {
    try {
      const parent = this.mainWindow.contentView;
      parent.removeChildView(this.sidebarView);
      parent.addChildView(this.sidebarView, 0); // index 0 = bottom
    } catch { /* view might already be removed */ }
  }

  // -- View bounds --

  private expandView(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
  }

  private shrinkView(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: EDGE_WIDTH, height });
  }

  // -- Timers --

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.overlayVisible) return;
      this.overlayVisible = false;

      // Animate out first
      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.shrinkView();
        this.sidebarToBack();
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
