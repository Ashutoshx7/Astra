import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - Zen-parity sidebar auto-hide.
 *
 * Zen's exact approach:
 *   Sidebar: position:fixed, z-index:10
 *   Hidden:  left: -width    (off-screen)
 *   Visible: left: 0         (on-screen, spring transition)
 *   Content: margin-left: 0  (always full width, sidebar floats over)
 *
 * Our Electron adaptation:
 *   Toggle HIDE:  animate content x from sidebarWidth → 0
 *                 (content slides left, "covering" sidebar)
 *                 Sidebar stays at x=0, becomes transparent after.
 *   Toggle SHOW:  sidebar solid bg at x=0,
 *                 animate content x from 0 → sidebarWidth
 *                 (content slides right, "revealing" sidebar)
 *   Overlay:      sidebar on top at x=0, content stays at x=0
 *                 (sidebar floats over content, like Zen hover)
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = '#1b1b1b';
const TRANSPARENT = '#00000000';
const EDGE_WIDTH = 12;
const HIDE_DELAY_MS = 300;
const ANIM_MS = 250;
const COOLDOWN_MS = 400;
const GRACE_MS = 500;

// Zen's spring curve as lookup table
const SPRING = [
  0, 0.002748, 0.010544, 0.022757, 0.038804, 0.058151, 0.080308, 0.104828,
  0.131301, 0.159358, 0.188662, 0.21891, 0.249828, 0.281172, 0.312724,
  0.344288, 0.375693, 0.40679, 0.437447, 0.467549, 0.497, 0.525718,
  0.553633, 0.580688, 0.60684, 0.632052, 0.656298, 0.679562, 0.701831,
  0.723104, 0.743381, 0.76267, 0.780983, 0.798335, 0.814744, 0.830233,
  0.844826, 0.858549, 0.87143, 0.883498, 0.894782, 0.905314, 0.915125,
  0.924247, 0.93271, 0.940547, 0.947787, 0.954463, 0.960603, 0.966239,
  0.971397, 0.976106, 0.980394, 0.984286, 0.987808, 0.990984, 0.993837,
  0.99639, 0.998664, 1.000679, 1.002456, 1.004011, 1.005363, 1.006528,
  1.007522, 1.008359, 1.009054, 1.009618, 1.010065, 1.010405, 1.010649,
  1.010808, 1.01089, 1.010904, 1.010857, 1.010757, 1.010611, 1.010425,
  1.010205, 1.009955, 1.009681, 1.009387, 1.009077, 1.008754, 1.008422,
  1.008083, 1.00774, 1.007396, 1.007052, 1.00671, 1.006372, 1.00604,
  1.005713, 1.005394, 1.005083, 1.004782, 1.004489, 1.004207, 1.003935,
  1.003674, 1.003423,
];

function spring(t: number): number {
  const i = t * 100;
  const lo = Math.floor(i);
  const hi = Math.min(lo + 1, 100);
  return SPRING[lo] + (SPRING[hi] - SPRING[lo]) * (i - lo);
}

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private overlayVisible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private animId: ReturnType<typeof setTimeout> | null = null;
  private cooldownUntil = 0;
  private showTimestamp = 0;
  private baseWidth = 300;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly layoutCallback: (sidebarWidth: number) => void,
  ) {}

  getMode(): CompactMode { return this.mode; }
  isSidebarVisible(): boolean { return this.mode === 'expanded' || this.overlayVisible; }
  getSidebarWidth(): number {
    if (this.mode === 'expanded') return this.baseWidth;
    return this.overlayVisible ? this.baseWidth : 0;
  }
  setBaseWidth(w: number): void { this.baseWidth = w; }
  getBaseWidth(): number { return this.baseWidth; }
  setResizing(_r: boolean): void {}

  // ==== Toggle ====

  toggleMode(): void {
    this.stop();

    if (this.mode === 'expanded') {
      // HIDE: content slides left (covering sidebar)
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sendState('hiding');

      this.animate(this.baseWidth, 0, ANIM_MS, (v) => {
        this.layoutCallback(v);
      }, () => {
        this.sidebarView.setBackgroundColor(TRANSPARENT);
        this.shrinkToEdge();
        this.sidebarToFront();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: hidden');
      });

    } else {
      // SHOW: make sidebar solid, then content slides right (revealing it)
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.setSidebarBounds(this.baseWidth);
      this.sidebarToBack();
      this.sendState('showing');

      this.animate(0, this.baseWidth, ANIM_MS, (v) => {
        this.layoutCallback(v);
      }, () => {
        this.sendState();
        console.log('[Astra] sidebar: expanded');
      });
    }
  }

  setMode(m: any): void {
    this.stop();
    if (m === 'expanded' || m === 'full') {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.setSidebarBounds(this.baseWidth);
      this.sidebarToBack();
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

  // ==== Overlay (hover) ====

  onEdgeEnter(): void {
    if (this.mode === 'expanded') return;
    if (this.overlayVisible) { this.clearHideTimer(); return; }
    if (this.animId) return;
    if (Date.now() < this.cooldownUntil) return;

    this.clearHideTimer();
    this.overlayVisible = true;
    this.showTimestamp = Date.now();

    // Expand sidebar view on top, content stays at x=0
    this.setSidebarBounds(this.baseWidth);
    this.sidebarToFront();
    this.sendState('showing');

    // Brief delay then show
    this.animId = setTimeout(() => {
      this.animId = null;
      this.sendState();
    }, ANIM_MS);

    console.log('[Astra] sidebar: overlay shown');
  }

  onEdgeLeave(): void {
    if (this.mode === 'expanded' || !this.overlayVisible) return;
    if (Date.now() - this.showTimestamp < GRACE_MS) return;
    this.startHideTimer();
  }

  onEdgeCancelHide(): void { this.clearHideTimer(); }
  handleMouseMove(): void {}
  flashSidebar(): void {}
  lockForPopup(): void {}
  unlockFromPopup(): void {}

  // ==== Animation ====

  private animate(
    from: number, to: number, ms: number,
    onFrame: (v: number) => void,
    onDone: () => void,
  ): void {
    this.stopAnim();
    const start = Date.now();
    const tick = () => {
      const t = Math.min((Date.now() - start) / ms, 1);
      const v = Math.round(from + (to - from) * spring(t));
      onFrame(v);
      if (t < 1) {
        this.animId = setTimeout(tick, 8); // ~120fps for smoother motion
      } else {
        this.animId = null;
        onDone();
      }
    };
    tick();
  }

  private stopAnim(): void {
    if (this.animId) { clearTimeout(this.animId); this.animId = null; }
  }

  private stop(): void {
    this.stopAnim();
    this.clearHideTimer();
  }

  // ==== View helpers ====

  private setSidebarBounds(w: number): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: w + 8, height });
  }

  private shrinkToEdge(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: EDGE_WIDTH, height });
  }

  private sidebarToFront(): void {
    try {
      const p = this.mainWindow.contentView;
      p.removeChildView(this.sidebarView);
      p.addChildView(this.sidebarView);
    } catch {}
  }

  private sidebarToBack(): void {
    try {
      const p = this.mainWindow.contentView;
      p.removeChildView(this.sidebarView);
      p.addChildView(this.sidebarView, 0);
    } catch {}
  }

  // ==== Timers ====

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.overlayVisible) return;
      this.overlayVisible = false;
      this.shrinkToEdge();
      this.cooldownUntil = Date.now() + COOLDOWN_MS;
      this.sendState();
      console.log('[Astra] sidebar: overlay hidden');
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  // ==== IPC ====

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
