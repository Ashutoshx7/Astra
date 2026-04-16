import { BaseWindow, WebContentsView } from 'electron';
import { IPC } from '../types';
import type { TabManager } from './TabManager';

/**
 * GlanceManager — Link preview overlay inspired by Zen Browser's ZenGlanceManager.
 *
 * Zen's implementation (1,921 lines) features:
 *   - Alt+click link → floating preview overlay
 *   - Arc animation from click position to center
 *   - Parent tab scales to 0.97× and fades to 30%
 *   - Preview at 80% width with rounded corners + shadow
 *   - Close/Expand/Split actions
 *   - Element screenshot as loading placeholder
 *
 * Our Electron adaptation:
 *   - Creates a hidden WebContentsView for the preview URL
 *   - Positions it as an overlay within the main window
 *   - Animates from small (at click position) to 80% width center
 *   - Actions: close (destroy view), expand (promote to tab), split (future)
 */

interface GlanceState {
  active: boolean;
  previewView: WebContentsView | null;
  previewUrl: string;
  parentTabId: string;
  // Animation start position (from click event)
  startX: number;
  startY: number;
}

// Preview occupies 80% of content width (Zen's value)
const PREVIEW_WIDTH_RATIO = 0.8;
// Vertical padding from top/bottom
const PREVIEW_VERTICAL_PADDING = 40;
// Animation duration in ms (Zen: 300ms)
const ANIMATION_DURATION = 300;
// Number of animation frames (Zen: 80)
const ANIMATION_STEPS = 20;

export class GlanceManager {
  private state: GlanceState = {
    active: false,
    previewView: null,
    previewUrl: '',
    parentTabId: '',
    startX: 0,
    startY: 0,
  };

  private animationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly mainWindow: BaseWindow,
    private readonly sidebarView: WebContentsView,
    private tabManager: TabManager | null = null,
  ) {}

  setTabManager(tm: TabManager): void {
    this.tabManager = tm;
  }

  // --------------------------------------------------
  // Public API
  // --------------------------------------------------

  isActive(): boolean {
    return this.state.active;
  }

  /**
   * Open a Glance preview for a URL.
   * Called when user Alt+clicks a link in a web page.
   *
   * Zen's flow: screenshot element → create hidden tab → animate arc
   * Our flow: create overlay view → animate position → show
   */
  open(url: string, clickX: number, clickY: number): void {
    if (this.state.active) {
      this.close();
    }

    const bounds = this.mainWindow.getContentBounds();
    const sidebarWidth = 280; // TODO: get from CompactModeManager

    const contentWidth = bounds.width - sidebarWidth;
    const contentHeight = bounds.height;
    const previewWidth = Math.floor(contentWidth * PREVIEW_WIDTH_RATIO);
    const previewHeight = contentHeight - PREVIEW_VERTICAL_PADDING * 2;

    // Create the preview WebContentsView
    const previewView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    // Start with a tiny size at the click position (for animation)
    const startWidth = 100;
    const startHeight = 60;
    previewView.setBounds({
      x: sidebarWidth + Math.min(clickX, contentWidth - startWidth),
      y: Math.min(clickY, contentHeight - startHeight),
      width: startWidth,
      height: startHeight,
    });

    // Apply rounded corners via CSS injection after load
    previewView.webContents.on('did-finish-load', () => {
      previewView.webContents.insertCSS(`
        :root {
          --glance-radius: 12px;
        }
        html {
          border-radius: var(--glance-radius);
          overflow: hidden;
        }
      `).catch(() => {});
    });

    previewView.webContents.loadURL(url);
    this.mainWindow.contentView.addChildView(previewView);

    // Store state
    this.state = {
      active: true,
      previewView,
      previewUrl: url,
      parentTabId: this.tabManager?.getActiveTabId() || '',
      startX: sidebarWidth + clickX,
      startY: clickY,
    };

    // Animate from click position to center (Zen's arc animation simplified)
    const targetX = sidebarWidth + Math.floor((contentWidth - previewWidth) / 2);
    const targetY = PREVIEW_VERTICAL_PADDING;

    this.animateToCenter(
      previewView,
      { x: this.state.startX, y: this.state.startY, w: startWidth, h: startHeight },
      { x: targetX, y: targetY, w: previewWidth, h: previewHeight },
    );

    // Notify sidebar (to show overlay UI controls)
    this.sidebarView.webContents.send('glance:opened', { url });

    console.log(`[Astra] 👁️ Glance opened: ${url}`);
  }

  /**
   * Close the Glance preview and clean up.
   */
  close(): void {
    if (!this.state.active || !this.state.previewView) return;

    this.cancelAnimation();

    try {
      this.mainWindow.contentView.removeChildView(this.state.previewView);
      this.state.previewView.webContents.close();
    } catch { /* already removed */ }

    this.state = {
      active: false,
      previewView: null,
      previewUrl: '',
      parentTabId: '',
      startX: 0,
      startY: 0,
    };

    this.sidebarView.webContents.send('glance:closed');
    console.log(`[Astra] 👁️ Glance closed`);
  }

  /**
   * Expand: promote the Glance preview to a full tab.
   * Zen calls this "expand" — the preview becomes a real tab.
   */
  expand(): void {
    if (!this.state.active) return;

    const url = this.state.previewUrl;
    this.close();

    // Create a new tab with the preview URL
    const tab = this.tabManager?.createTab(url);
    if (tab) {
      this.tabManager?.switchToTab(tab.id);
    }

    console.log(`[Astra] 👁️ Glance expanded to tab: ${url}`);
  }

  // --------------------------------------------------
  // Private: Animation
  // --------------------------------------------------

  /**
   * Animate preview from start rect to target rect.
   *
   * Zen uses an arc path with easeOutBack (overshoots then settles).
   * We implement a simplified version with easeOutCubic.
   */
  private animateToCenter(
    view: WebContentsView,
    start: { x: number; y: number; w: number; h: number },
    target: { x: number; y: number; w: number; h: number },
  ): void {
    this.cancelAnimation();

    let step = 0;
    const stepDuration = ANIMATION_DURATION / ANIMATION_STEPS;

    const animate = () => {
      if (step >= ANIMATION_STEPS || !this.state.active) return;

      step++;
      const t = step / ANIMATION_STEPS;

      // Zen's easeOutCubic: fast start, slow end
      const eased = 1 - Math.pow(1 - t, 3);

      // Add subtle arc (Zen's signature arc path)
      const arcHeight = 15;
      const arcOffset = arcHeight * Math.sin(t * Math.PI);

      const x = Math.round(this.lerp(start.x, target.x, eased));
      const y = Math.round(this.lerp(start.y, target.y, eased) - arcOffset);
      const w = Math.round(this.lerp(start.w, target.w, eased));
      const h = Math.round(this.lerp(start.h, target.h, eased));

      try {
        view.setBounds({ x, y, width: Math.max(w, 50), height: Math.max(h, 50) });
      } catch { /* view might be destroyed */ }

      this.animationTimer = setTimeout(animate, stepDuration);
    };

    animate();
  }

  private cancelAnimation(): void {
    if (this.animationTimer) {
      clearTimeout(this.animationTimer);
      this.animationTimer = null;
    }
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
