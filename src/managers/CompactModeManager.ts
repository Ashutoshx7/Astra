import { BaseWindow, WebContentsView } from 'electron';

/**
 * CompactModeManager - sidebar auto-hide with smooth overlay.
 *
 * Problem: sidebar is a separate Electron WebContentsView.
 * When hidden, we need content to receive clicks, but also
 * need to detect mouse at the left edge for hover reveal.
 *
 * Solution: setIgnoreMouseEvents API.
 * - Hidden: sidebar view is full-width, transparent, click-through.
 *   setIgnoreMouseEvents(true, { forward: true }) passes clicks to content
 *   but still forwards mousemove to the sidebar renderer.
 * - Renderer tracks mousemove. When cursor enters left edge zone,
 *   sends IPC. Main process disables ignoreMouseEvents so sidebar
 *   can receive full mouse interaction.
 * - When mouse leaves sidebar, re-enables ignoreMouseEvents.
 */

export type CompactMode = 'expanded' | 'hidden';

const BG_COLOR = '#1b1b1b';
const TRANSPARENT = '#00000000';
const EDGE_ZONE_PX = 8;
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
        this.enterHiddenMode();
        this.sendState();
      }, ANIM_DURATION_MS);

    } else {
      this.mode = 'expanded';
      this.overlayVisible = false;
      this.exitHiddenMode();
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
      this.exitHiddenMode();
    } else {
      this.mode = 'hidden';
      this.overlayVisible = false;
      this.enterHiddenMode();
    }
    this.sendState();
  }

  /** Called from renderer when mouse enters edge zone (x < EDGE_ZONE_PX) */
  onEdgeEnter(): void {
    if (this.mode === 'expanded' || this.overlayVisible) return;
    this.clearAllTimers();
    this.overlayVisible = true;

    // Stop ignoring mouse events so sidebar is fully interactive
    this.sidebarView.webContents.setIgnoreMouseEvents(false);
    this.sidebarToFront();

    this.sendState('showing');

    this.animTimer = setTimeout(() => {
      this.animTimer = null;
      this.sendState();
    }, ANIM_DURATION_MS);

    console.log('[Astra] sidebar: overlay');
  }

  /** Called from renderer when mouse leaves sidebar area */
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

  // -- Mode transitions --

  private enterHiddenMode(): void {
    // Make sidebar transparent so content shows through
    this.sidebarView.setBackgroundColor(TRANSPARENT);
    // Put sidebar on top (transparent, won't block visually)
    this.sidebarToFront();
    // Make click-through but keep receiving mousemove
    this.sidebarView.webContents.setIgnoreMouseEvents(true, { forward: true });
    // Content fills window
    this.layoutCallback(0);
  }

  private exitHiddenMode(): void {
    // Restore solid background
    this.sidebarView.setBackgroundColor(BG_COLOR);
    // Stop ignoring mouse events
    this.sidebarView.webContents.setIgnoreMouseEvents(false);
    // Put sidebar behind content (normal layout)
    this.sidebarToBack();
    // Restore sidebar view size
    const { height } = this.mainWindow.getContentBounds();
    this.sidebarView.setBounds({ x: 0, y: 0, width: this.baseWidth + 8, height });
    // Content adjusts
    this.layoutCallback(this.baseWidth);
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
        // Re-enable click-through
        this.sidebarView.webContents.setIgnoreMouseEvents(true, { forward: true });
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
      edgeZone: EDGE_ZONE_PX,
    });
  }
}
