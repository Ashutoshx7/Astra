import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - sidebar auto-hide, Zen-style.
 *
 * Zen approach (from sidebar.inc.css):
 *   position: fixed; left: -width → left: 0
 *   transition: left 0.25s spring()
 *
 * Our Electron adaptation:
 *   Toggle: animate sidebar view x from -width → 0 (and back),
 *   plus content view position. All JS, no CSS animations.
 *   Overlay: same JS animation for slide, no CSS classes needed.
 *
 * Key insight: CSS translateX animations inside a WebContentsView
 * fight with JS view bounds changes. Use ONE animation system (JS)
 * for everything.
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = '#1b1b1b';
const TRANSPARENT = '#00000000';
const EDGE_WIDTH = 12;
const HIDE_DELAY_MS = 300;
const ANIM_MS = 250; // Zen uses 0.25s
const COOLDOWN_MS = 400;
const GRACE_MS = 500;

// Spring timing function (Zen's 100 control points) as a lookup table
const SPRING_TABLE = [
  0, 0.002748, 0.010544, 0.022757, 0.038804,
  0.058151, 0.080308, 0.104828, 0.131301, 0.159358,
  0.188662, 0.21891, 0.249828, 0.281172, 0.312724,
  0.344288, 0.375693, 0.40679, 0.437447, 0.467549,
  0.497, 0.525718, 0.553633, 0.580688, 0.60684,
  0.632052, 0.656298, 0.679562, 0.701831, 0.723104,
  0.743381, 0.76267, 0.780983, 0.798335, 0.814744,
  0.830233, 0.844826, 0.858549, 0.87143, 0.883498,
  0.894782, 0.905314, 0.915125, 0.924247, 0.93271,
  0.940547, 0.947787, 0.954463, 0.960603, 0.966239,
  0.971397, 0.976106, 0.980394, 0.984286, 0.987808,
  0.990984, 0.993837, 0.99639, 0.998664, 1.000679,
  1.002456, 1.004011, 1.005363, 1.006528, 1.007522,
  1.008359, 1.009054, 1.009618, 1.010065, 1.010405,
  1.010649, 1.010808, 1.01089, 1.010904, 1.010857,
  1.010757, 1.010611, 1.010425, 1.010205, 1.009955,
  1.009681, 1.009387, 1.009077, 1.008754, 1.008422,
  1.008083, 1.00774, 1.007396, 1.007052, 1.00671,
  1.006372, 1.00604, 1.005713, 1.005394, 1.005083,
  1.004782, 1.004489, 1.004207, 1.003935, 1.003674,
  1.003423,
];

function springEase(t: number): number {
  const idx = t * 100;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, 100);
  const frac = idx - lo;
  return SPRING_TABLE[lo] + (SPRING_TABLE[hi] - SPRING_TABLE[lo]) * frac;
}

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private overlayVisible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private animFrameId: ReturnType<typeof setTimeout> | null = null;
  private cooldownUntil = 0;
  private showTimestamp = 0;
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

  // ---- Toggle ----

  toggleMode(): void {
    this.stopAnim();
    this.clearHideTimer();

    if (this.mode === 'expanded') {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sendState('hiding');

      // Animate: sidebar slides left, content expands
      this.animateSlide(0, -this.baseWidth, this.baseWidth, 0, ANIM_MS, false, () => {
        this.sidebarView.setBackgroundColor(TRANSPARENT);
        this.shrinkToEdge();
        this.sidebarToFront();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
      });

    } else {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.sidebarToBack();
      this.sendState('showing');

      // Animate: sidebar slides in from left, content contracts
      this.animateSlide(-this.baseWidth, 0, 0, this.baseWidth, ANIM_MS, true, () => {
        this.sendState();
      });
    }
    console.log(`[Astra] sidebar: ${this.mode}`);
  }

  setMode(mode: any): void {
    this.stopAnim();
    this.clearHideTimer();
    if (mode === 'expanded' || mode === 'full') {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.sidebarToBack();
      this.setSidebarX(0);
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

  // ---- Overlay (hover) ----

  onEdgeEnter(): void {
    if (this.mode === 'expanded') return;
    if (this.overlayVisible) { this.clearHideTimer(); return; }
    if (this.animFrameId) return;
    if (Date.now() < this.cooldownUntil) return;

    this.clearHideTimer();
    this.overlayVisible = true;
    this.showTimestamp = Date.now();

    // Expand view + animate slide in
    this.sidebarToFront();
    this.sendState('showing');
    this.animateSlide(-this.baseWidth, 0, 0, 0, ANIM_MS, true, () => {
      this.sendState();
    });

    console.log('[Astra] sidebar: overlay shown');
  }

  onEdgeLeave(): void {
    if (this.mode === 'expanded' || !this.overlayVisible) return;
    if (Date.now() - this.showTimestamp < GRACE_MS) return;
    this.startHideTimer();
  }

  onEdgeCancelHide(): void {
    this.clearHideTimer();
  }

  handleMouseMove(_x: number, _y: number): void {}
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}

  // ---- Slide animation (Zen spring) ----

  /**
   * Animate sidebar position and content position simultaneously.
   * sidebarXFrom/To: sidebar view x position
   * contentFrom/To: content layout width (passed to layoutCallback)
   */
  private animateSlide(
    sidebarXFrom: number, sidebarXTo: number,
    contentFrom: number, contentTo: number,
    duration: number, useSpring: boolean,
    onDone: () => void,
  ): void {
    this.stopAnim();
    const start = Date.now();

    const tick = () => {
      const elapsed = Date.now() - start;
      const rawT = Math.min(elapsed / duration, 1);
      const t = useSpring ? springEase(rawT) : easeOutCubic(rawT);

      const sidebarX = Math.round(sidebarXFrom + (sidebarXTo - sidebarXFrom) * t);
      const contentW = Math.round(contentFrom + (contentTo - contentFrom) * t);

      this.setSidebarX(sidebarX);
      if (contentTo !== contentFrom) {
        this.layoutCallback(contentW);
      }

      if (rawT < 1) {
        this.animFrameId = setTimeout(tick, 16);
      } else {
        this.animFrameId = null;
        onDone();
      }
    };

    tick();
  }

  private stopAnim(): void {
    if (this.animFrameId) {
      clearTimeout(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // ---- View helpers ----

  private setSidebarX(x: number): void {
    const { height } = this.mainWindow.getContentBounds();
    const w = this.baseWidth + 8;
    this.sidebarView.setBounds({ x, y: 0, width: w, height });
  }

  private shrinkToEdge(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: EDGE_WIDTH, height });
  }

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

  // ---- Timers ----

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.overlayVisible) return;

      this.sendState('hiding');

      // Animate slide out, then shrink
      this.animateSlide(0, -this.baseWidth, 0, 0, ANIM_MS, false, () => {
        this.overlayVisible = false;
        this.shrinkToEdge();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: overlay hidden');
      });
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  // ---- IPC ----

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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
