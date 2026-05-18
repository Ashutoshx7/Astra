import { BaseWindow, WebContentsView } from 'electron';
import { CONFIG } from '../types';

/**
 * CompactModeManager - Zen-exact sidebar auto-hide.
 *
 * CORE PRINCIPLE (from Zen):
 *   In compact mode, content is ALWAYS full width.
 *   Sidebar ALWAYS floats on top as an overlay.
 *   Toggle just shows/hides the floating sidebar.
 *   Content NEVER moves. Zero snapping.
 *
 * States:
 *   'expanded' - normal mode, sidebar takes layout space
 *   'hidden'   - compact mode, sidebar floats (overlay)
 *
 * enterCompactMode(): expanded → hidden (one-time setup)
 * exitCompactMode():  hidden → expanded (restore layout)
 * toggleMode():       show/hide the floating sidebar
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = CONFIG.WINDOW.BG_COLOR;
const TRANSPARENT = '#00000000';
const EDGE_WIDTH = 14;
const HIDE_DELAY_MS = 240;
const ANIM_MS = 220;
const COOLDOWN_MS = 260;
const GRACE_MS = 220;

type SidebarAnimation = 'hiding' | 'showing';

export class CompactModeManager {
  private mode: CompactMode = 'expanded';
  private overlayVisible = false;
  private edgeHovered = false;
  private popupLocked = false;
  private resizing = false;
  private animating: SidebarAnimation | null = null;
  private showTimer: ReturnType<typeof setTimeout> | null = null;
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
  setResizing(r: boolean): void {
    this.resizing = r;
    if (r) {
      this.clearHideTimer();
    } else if (this.overlayVisible && !this.edgeHovered) {
      this.queueHide();
    }
  }

  // ==== Toggle ====

  toggleMode(): void {
    this.clearAll();
    this.edgeHovered = false;

    if (this.mode === 'expanded') {
      // Enter compact mode: content goes full width, sidebar becomes overlay
      this.mode = 'hidden';
      this.overlayVisible = false;

      // Content goes full width ONCE (this is entering compact mode)
      this.layoutCallback(0);

      // Sidebar slides out via CSS
      this.sidebarView.setBackgroundColor(TRANSPARENT);
      this.sidebarToFront();

      this.startAnimation('hiding', () => {
        this.shrinkToEdge();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: compact mode on');
      });

    } else if (this.overlayVisible) {
      // Already in compact mode, sidebar showing → hide it
      this.overlayVisible = false;

      this.startAnimation('hiding', () => {
        this.shrinkToEdge();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: hidden');
      });

    } else {
      // Compact mode, sidebar hidden → exit compact mode, restore layout
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(TRANSPARENT);
      this.setSidebarFull();
      this.sidebarToFront();

      // CSS slideIn first, content stays at x=0 during animation
      this.startAnimation('showing', () => {
        // NOW move content (after sidebar is fully visible)
        this.sidebarToBack();
        this.layoutCallback(this.baseWidth);
        this.sidebarView.setBackgroundColor(BG_COLOR);
        this.sendState();
        console.log('[Astra] sidebar: compact mode off');
      });
    }
  }

  setMode(m: CompactMode | 'full' | string): void {
    this.clearAll();
    this.edgeHovered = false;
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
    this.edgeHovered = true;
    this.clearHideTimer();

    if (this.overlayVisible && this.animating !== 'hiding') return;

    const cooldownRemaining = this.cooldownUntil - Date.now();
    if (!this.overlayVisible && cooldownRemaining > 0) {
      this.startShowTimer(cooldownRemaining);
      return;
    }

    this.showOverlay();
  }

  onEdgeLeave(): void {
    if (this.mode === 'expanded') return;
    this.edgeHovered = false;
    this.clearShowTimer();
    if (!this.overlayVisible) return;
    this.queueHide();
  }

  onEdgeCancelHide(): void { this.clearHideTimer(); }
  handleMouseMove(_x: number, _y: number): void {
    void _x;
    void _y;
  }
  flashSidebar(): void {
    return;
  }
  lockForPopup(): void {
    this.popupLocked = true;
    this.clearHideTimer();
  }
  unlockFromPopup(): void {
    this.popupLocked = false;
    if (this.overlayVisible && !this.edgeHovered) this.queueHide();
  }

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
    } catch {
      /* view may already be detached during window teardown */
    }
  }

  private sidebarToBack(): void {
    try {
      const p = this.mainWindow.contentView;
      p.removeChildView(this.sidebarView);
      p.addChildView(this.sidebarView, 0);
    } catch {
      /* view may already be detached during window teardown */
    }
  }

  // ==== Timers ====

  private showOverlay(): void {
    this.clearShowTimer();
    this.clearHideTimer();
    this.overlayVisible = true;
    this.showTimestamp = Date.now();

    // Show sidebar as overlay (content stays at x=0)
    this.setSidebarFull();
    this.sidebarToFront();
    this.startAnimation('showing', () => this.sendState());

    console.log('[Astra] sidebar: overlay shown');
  }

  private queueHide(): void {
    if (!this.canAutoHide()) return;

    const elapsed = Date.now() - this.showTimestamp;
    const graceRemaining = Math.max(0, GRACE_MS - elapsed);
    this.startHideTimer(graceRemaining + HIDE_DELAY_MS);
  }

  private canAutoHide(): boolean {
    return (
      this.mode === 'hidden' &&
      this.overlayVisible &&
      !this.edgeHovered &&
      !this.popupLocked &&
      !this.resizing
    );
  }

  private startShowTimer(delay: number): void {
    this.clearShowTimer();
    this.showTimer = setTimeout(() => {
      this.showTimer = null;
      if (this.edgeHovered && this.mode === 'hidden' && !this.overlayVisible) {
        this.showOverlay();
      }
    }, delay);
  }

  private startHideTimer(delay: number): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.canAutoHide()) return;

      this.startAnimation('hiding', () => {
        if (!this.canAutoHide()) {
          this.sendState();
          return;
        }
        this.overlayVisible = false;
        this.shrinkToEdge();
        this.cooldownUntil = Date.now() + COOLDOWN_MS;
        this.sendState();
        console.log('[Astra] sidebar: overlay hidden');
      });
    }, delay);
  }

  private startAnimation(animating: SidebarAnimation, onDone: () => void): void {
    this.clearAnimationTimer();
    this.animating = animating;
    this.sendState(animating);
    this.animTimer = setTimeout(() => {
      this.animTimer = null;
      this.animating = null;
      onDone();
    }, ANIM_MS);
  }

  private clearShowTimer(): void {
    if (this.showTimer) { clearTimeout(this.showTimer); this.showTimer = null; }
  }

  private clearHideTimer(): void {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
  }

  private clearAnimationTimer(): void {
    if (this.animTimer) { clearTimeout(this.animTimer); this.animTimer = null; }
    this.animating = null;
  }

  private clearAll(): void {
    this.clearHideTimer();
    this.clearShowTimer();
    this.clearAnimationTimer();
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
