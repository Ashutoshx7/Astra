import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - sidebar auto-hide with smooth transitions.
 *
 * Key insight: view bounds must change AFTER animations complete,
 * not before. Otherwise the resize causes visual glitching.
 *
 * Flow:
 * - Hide: notify renderer (slide-out anim) → wait → shrink view
 * - Show: expand view → notify renderer (slide-in anim)
 */

export type CompactMode = 'expanded' | 'hidden';

const EDGE_WIDTH = 12;
const HIDE_DELAY_MS = 300;
const ANIM_DURATION_MS = 220;  // matches CSS animation duration

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
      // HIDE: animate out first, then shrink view
      this.mode = 'hidden';
      this.overlayVisible = false;

      // Tell renderer to start slide-out animation
      this.sendState('hiding');

      // After animation finishes, actually shrink the view
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.shrinkView();
        this.sendState();
      }, ANIM_DURATION_MS);

    } else {
      // SHOW: expand view first, then animate in
      this.mode = 'expanded';
      this.overlayVisible = false;

      // Expand view immediately
      this.expandView();
      this.layoutCallback(this.baseWidth);

      // Tell renderer to animate in
      this.sendState('showing');

      // Clear the showing flag after animation
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
      this.expandView();
      this.layoutCallback(this.baseWidth);
    } else {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.shrinkView();
    }
    this.sendState();
  }

  /** Mouse entered the edge strip */
  onEdgeEnter(): void {
    if (this.mode === 'expanded' || this.overlayVisible) return;
    this.clearHideTimer();
    this.overlayVisible = true;

    // Expand view, then tell renderer to animate in
    this.expandView();
    this.sendState('showing');

    this.animTimer = setTimeout(() => {
      this.animTimer = null;
      this.sendState();
    }, ANIM_DURATION_MS);

    console.log('[Astra] sidebar: overlay shown');
  }

  /** Mouse left the sidebar area */
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

  // -- View management --

  private expandView(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
  }

  private shrinkView(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: EDGE_WIDTH, height });
    this.layoutCallback(0);
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
