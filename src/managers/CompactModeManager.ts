import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - Zen-parity sidebar auto-hide.
 *
 * Critical rule: content reacts INSTANTLY. No delay.
 * Sidebar CSS animation is purely visual (floats on top).
 *
 * Toggle HIDE:
 *   1. Move sidebar to FRONT (floats over content)
 *   2. Content expands to full width IMMEDIATELY
 *   3. CSS slideOut animates sidebar off-screen (GPU-composited)
 *   4. After 250ms: shrink sidebar to 12px edge strip
 *
 * Toggle SHOW:
 *   1. Expand sidebar view ON TOP, solid bg
 *   2. Content shifts right IMMEDIATELY
 *   3. CSS slideIn animates sidebar from left (GPU-composited)
 *   4. After 250ms: move sidebar to BACK (normal z-order)
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = '#1b1b1b';
const TRANSPARENT = '#00000000';
const EDGE_WIDTH = 12;
const HIDE_DELAY_MS = 300;
const ANIM_MS = 250;
const COOLDOWN_MS = 400;
const GRACE_MS = 500;

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private overlayVisible = false;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private animTimer: ReturnType<typeof setTimeout> | null = null;
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
    this.clearAll();

    if (this.mode === 'expanded') {
      // HIDE
      this.mode = 'hidden';
      this.overlayVisible = false;

      // Sidebar floats on top during animation
      this.sidebarToFront();

      // Content expands IMMEDIATELY (no delay)
      this.layoutCallback(0);

      // CSS slideOut starts
      this.sendState('hiding');

      // After animation: finalize
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.sidebarView.setBackgroundColor(TRANSPARENT);
        this.shrinkToEdge();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: hidden');
      }, ANIM_MS);

    } else {
      // SHOW
      this.mode = 'expanded';
      this.overlayVisible = false;

      // Sidebar on top during animation (so slideIn is visible)
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.setSidebarFull();
      this.sidebarToFront();

      // Content shifts right IMMEDIATELY
      this.layoutCallback(this.baseWidth);

      // CSS slideIn starts
      this.sendState('showing');

      // After animation: sidebar goes behind content (normal z-order)
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.sidebarToBack();
        this.sendState();
        console.log('[Astra] sidebar: expanded');
      }, ANIM_MS);
    }
  }

  setMode(m: any): void {
    this.clearAll();
    if (m === 'expanded' || m === 'full') {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.setSidebarFull();
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
    if (this.animTimer) return;
    if (Date.now() < this.cooldownUntil) return;

    this.clearHideTimer();
    this.overlayVisible = true;
    this.showTimestamp = Date.now();

    // Sidebar on top, CSS slideIn
    this.setSidebarFull();
    this.sidebarToFront();
    this.sendState('showing');

    this.animTimer = setTimeout(() => {
      this.animTimer = null;
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

  // ==== View helpers ====

  private setSidebarFull(): void {
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
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

      // CSS slideOut
      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.overlayVisible = false;
        this.shrinkToEdge();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: overlay hidden');
      }, ANIM_MS);
    }, HIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  private clearAll(): void {
    this.clearHideTimer();
    if (this.animTimer) { clearTimeout(this.animTimer); this.animTimer = null; }
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
