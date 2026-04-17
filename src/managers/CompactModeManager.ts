import { BaseWindow, WebContentsView } from 'electron';
import { IPC } from '../types';

/**
 * CompactModeManager — Auto-hide sidebar inspired by Zen Browser's ZenCompactMode.
 *
 * Zen's implementation (998 lines) handles:
 *   - Three modes: sidebar-only, toolbar-only, both
 *   - Edge hover detection per element
 *   - Spring animation via CSS linear() 100-point curve
 *   - Popup tracking (don't hide when menu is open)
 *   - Flash sidebar on events
 *
 * Our Electron adaptation:
 *   - Sidebar width toggles between full (280px) and collapsed (0px)
 *   - Mouse near left edge reveals sidebar
 *   - Sidebar overlays content as fixed-position glass panel
 *   - 250ms spring transition
 */

export type CompactMode = 'full' | 'compact' | 'zen';

interface CompactState {
  mode: CompactMode;
  sidebarVisible: boolean;
  sidebarHoverLocked: boolean;       // Keep visible while interacting
  hideTimer: ReturnType<typeof setTimeout> | null;
  flashTimer: ReturnType<typeof setTimeout> | null;
}

// Edge detection zone width (px)
const EDGE_ZONE = 8;
// Delay before hiding after mouse leaves (Zen: 150ms)
const KEEP_HOVER_MS = 300;
// Flash duration for events (Zen: 800ms)
const FLASH_DURATION_MS = 800;
// Sidebar width when visible
const SIDEBAR_WIDTH = 320;

export class CompactModeManager {
  private state: CompactState = {
    mode: 'full',
    sidebarVisible: true,
    sidebarHoverLocked: false,
    hideTimer: null,
    flashTimer: null,
  };

  // Track mouse position via IPC from renderer
  private lastMouseX = 0;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private readonly layoutCallback: (sidebarWidth: number) => void,
  ) {}

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  getMode(): CompactMode {
    return this.state.mode;
  }

  isSidebarVisible(): boolean {
    return this.state.mode === 'full' || this.state.sidebarVisible;
  }

  getSidebarWidth(): number {
    return this.isSidebarVisible() ? SIDEBAR_WIDTH : 0;
  }

  /**
   * Toggle compact mode. Cycles: full → compact → zen → full
   * (Zen's Ctrl+S shortcut)
   */
  toggleMode(): void {
    const modes: CompactMode[] = ['full', 'compact', 'zen'];
    const currentIndex = modes.indexOf(this.state.mode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    this.setMode(nextMode);
  }

  setMode(mode: CompactMode): void {
    this.state.mode = mode;

    if (mode === 'full') {
      this.showSidebar();
      this.state.sidebarHoverLocked = false;
    } else {
      this.hideSidebar();
    }

    this.notifySidebar();
    console.log(`[Astra] 📐 Compact mode: ${mode}`);
  }

  /**
   * Handle mouse position updates from the renderer.
   * Zen detects edge proximity per-element; we simplify to left-edge.
   */
  handleMouseMove(x: number, y: number): void {
    this.lastMouseX = x;

    if (this.state.mode === 'full') return;

    // Mouse entered edge zone → show sidebar
    if (x <= EDGE_ZONE && !this.state.sidebarVisible) {
      this.clearHideTimer();
      this.showSidebar();
      this.state.sidebarHoverLocked = true;
      return;
    }

    // Mouse left the sidebar area → start hide timer
    if (x > SIDEBAR_WIDTH && this.state.sidebarVisible && this.state.sidebarHoverLocked) {
      this.startHideTimer();
    }

    // Mouse re-entered sidebar → cancel hide
    if (x <= SIDEBAR_WIDTH && this.state.sidebarHoverLocked) {
      this.clearHideTimer();
    }
  }

  /**
   * Flash the sidebar briefly on important events
   * (Zen: new tab opened, notification, etc.)
   */
  flashSidebar(): void {
    if (this.state.mode === 'full' || this.state.sidebarVisible) return;

    this.showSidebar();

    if (this.state.flashTimer) clearTimeout(this.state.flashTimer);
    this.state.flashTimer = setTimeout(() => {
      this.state.flashTimer = null;
      // Only hide if mouse isn't hovering
      if (this.lastMouseX > SIDEBAR_WIDTH) {
        this.hideSidebar();
      }
    }, FLASH_DURATION_MS);
  }

  /**
   * Lock sidebar visibility while a popup/menu is open
   * (Zen's popup tracking pattern)
   */
  lockForPopup(): void {
    this.clearHideTimer();
    this.state.sidebarHoverLocked = true;
    if (!this.state.sidebarVisible && this.state.mode !== 'full') {
      this.showSidebar();
    }
  }

  unlockFromPopup(): void {
    this.state.sidebarHoverLocked = false;
    if (this.state.mode !== 'full' && this.lastMouseX > SIDEBAR_WIDTH) {
      this.startHideTimer();
    }
  }

  // --------------------------------------------------
  // Private: Show/Hide with layout recalculation
  // --------------------------------------------------

  private showSidebar(): void {
    if (this.state.sidebarVisible) return;
    this.state.sidebarVisible = true;
    this.updateLayout();
    this.notifySidebar();
  }

  private hideSidebar(): void {
    if (!this.state.sidebarVisible) return;
    this.state.sidebarVisible = false;
    this.state.sidebarHoverLocked = false;
    this.updateLayout();
    this.notifySidebar();
  }

  private updateLayout(): void {
    const width = this.getSidebarWidth();
    this.layoutCallback(width);
  }

  private startHideTimer(): void {
    this.clearHideTimer();
    this.state.hideTimer = setTimeout(() => {
      this.state.hideTimer = null;
      this.hideSidebar();
    }, KEEP_HOVER_MS);
  }

  private clearHideTimer(): void {
    if (this.state.hideTimer) {
      clearTimeout(this.state.hideTimer);
      this.state.hideTimer = null;
    }
  }

  private notifySidebar(): void {
    this.sidebarView.webContents.send('compact:state', {
      mode: this.state.mode,
      sidebarVisible: this.state.sidebarVisible,
    });
  }
}
