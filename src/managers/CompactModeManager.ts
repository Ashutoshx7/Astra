import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - sidebar auto-hide with smooth overlay.
 *
 * How it works:
 * - Normal (expanded): sidebar view has solid bg, sits behind content,
 *   content starts after sidebar. Standard layout.
 *
 * - Hidden: sidebar view stays at full width but is TRANSPARENT.
 *   Content fills the entire window (renders through transparent sidebar view).
 *   The sidebar HTML is hidden via CSS (sidebar-hidden class).
 *
 * - Overlay (hover): sidebar view is still full-width + transparent.
 *   Sidebar HTML slides in via CSS animation, with its own bg.
 *   Content is visible through the transparent parts of the view.
 *   Sidebar appears to float on top of the content.
 *
 * This avoids ALL view resizing during overlay, making it glitch-free.
 * The only view resize happens on toggle (expanded <-> hidden).
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = '#1b1b1b';
const TRANSPARENT = '#00000000';
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
      // HIDE: animate out, then reconfigure
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        // Make sidebar transparent so content shows through
        this.sidebarView.setBackgroundColor(TRANSPARENT);
        // Bring sidebar to front (it's transparent, won't block anything)
        this.sidebarToFront();
        // Content fills full window
        this.layoutCallback(0);
        this.sendState();
      }, ANIM_DURATION_MS);

    } else {
      // SHOW: reconfigure, then animate in
      this.mode = 'expanded';
      this.overlayVisible = false;

      // Restore solid background, put sidebar behind content
      this.sidebarView.setBackgroundColor(BG_COLOR);
      this.sidebarToBack();
      // Set sidebar view to proper width
      const { height } = this.mainWindow.getContentBounds();
      this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
      // Content adjusts
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
      const { height } = this.mainWindow.getContentBounds();
      this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
      this.layoutCallback(this.baseWidth);
    } else {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.sidebarView.setBackgroundColor(TRANSPARENT);
      this.sidebarToFront();
      this.layoutCallback(0);
    }
    this.sendState();
  }

  /** Mouse entered the sidebar view area near the left edge */
  onEdgeEnter(): void {
    if (this.mode === 'expanded' || this.overlayVisible) return;
    this.clearAllTimers();
    this.overlayVisible = true;

    // View is already transparent + full width + on top
    // Just tell renderer to show sidebar with animation
    this.sendState('showing');

    this.animTimer = setTimeout(() => {
      this.animTimer = null;
      this.sendState();
    }, ANIM_DURATION_MS);

    console.log('[Astra] sidebar: overlay');
  }

  /** Mouse left sidebar area */
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

  // -- Z-order --

  private sidebarToFront(): void {
    try {
      const parent = this.mainWindow.contentView;
      parent.removeChildView(this.sidebarView);
      parent.addChildView(this.sidebarView); // end = top
    } catch {}
  }

  private sidebarToBack(): void {
    try {
      const parent = this.mainWindow.contentView;
      parent.removeChildView(this.sidebarView);
      parent.addChildView(this.sidebarView, 0); // index 0 = bottom
    } catch {}
  }

  // -- Timers --

  private startHideTimer(): void {
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      if (!this.overlayVisible) return;

      // Animate out
      this.sendState('hiding');

      this.animTimer = setTimeout(() => {
        this.animTimer = null;
        this.overlayVisible = false;
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
