import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - Zen-parity sidebar auto-hide.
 *
 * KEY INSIGHT from Zen:
 *   CSS transitions are GPU-accelerated. setBounds is not.
 *   Never animate setBounds. Use CSS for visual smoothness,
 *   then snap bounds once after animation completes.
 *
 * Toggle HIDE:
 *   1. Send 'hiding' → renderer plays CSS slideOut (GPU-accelerated)
 *   2. After 250ms: snap bounds (sidebar 12px, content full width)
 *
 * Toggle SHOW:
 *   1. Snap bounds first (sidebar full width, content offset)
 *   2. Send 'showing' → renderer plays CSS slideIn (GPU-accelerated)
 *   3. After 250ms: send final state
 *
 * Overlay:
 *   1. Expand sidebar view (transparent bg, on top)
 *   2. Send 'showing' → renderer plays CSS slideIn
 *   3. On leave: send 'hiding' → CSS slideOut, then shrink
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
      // HIDE: CSS slideOut first, then snap bounds
      this.mode = 'hidden';
      this.overlayVisible = false;

      // Step 1: trigger CSS slideOut animation (GPU-accelerated)
      this.sendState('hiding');

      // Step 2: after animation, snap bounds
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.sidebarView.setBackgroundColor(TRANSPARENT);
        this.shrinkToEdge();
        this.sidebarToFront();
        this.layoutCallback(0);
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: hidden');
      }, ANIM_MS);

    } else {
      // SHOW: snap bounds first, then CSS slideIn
      this.mode = 'expanded';
      this.overlayVisible = false;

      // Step 1: snap bounds (sidebar behind content, solid bg)
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.setSidebarFull();
      this.sidebarToBack();
      this.layoutCallback(this.baseWidth);

      // Step 2: trigger CSS slideIn animation (GPU-accelerated)
      this.sendState('showing');

      // Step 3: after animation, send final state
      this.animTimer = setTimeout(() => {
        this.animTimer = null;
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

    // Expand sidebar view on top, CSS slideIn
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

      // CSS slideOut first
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
