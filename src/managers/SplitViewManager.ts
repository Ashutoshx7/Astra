import { BaseWindow, WebContentsView } from 'electron';
import { IPC } from '../types';
import type { TabManager } from './TabManager';

/**
 * SplitViewManager — Side-by-side tab viewing inspired by both
 * Helium's C++ BrowserViewLayoutManager and Zen's ZenViewSplitter.
 *
 * Helium approach (C++): modifies BrowserViewLayout to split the content area
 * Zen approach (JS): uses a tabbox with deck elements for grid layouts
 *
 * Our Electron approach:
 *   - Manages two WebContentsViews side by side
 *   - Left/Right or Top/Bottom split with resizable divider
 *   - Drag a tab to split, or use keyboard shortcut
 *   - Each pane maintains independent navigation
 */

export type SplitDirection = 'horizontal' | 'vertical';

interface SplitState {
  active: boolean;
  direction: SplitDirection;
  leftTabId: string;
  rightTabId: string;
  ratio: number;       // 0.0-1.0, percentage for left/top pane
  dragging: boolean;
}

// Minimum pane size (px)
const MIN_PANE_SIZE = 200;
// Divider width
const DIVIDER_SIZE = 4;

export class SplitViewManager {
  private state: SplitState = {
    active: false,
    direction: 'horizontal',
    leftTabId: '',
    rightTabId: '',
    ratio: 0.5,
    dragging: false,
  };

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

  getState(): SplitState {
    return { ...this.state };
  }

  /**
   * Enter split view with two tabs side by side.
   * If no second tab specified, splits the active + next tab.
   */
  split(leftTabId: string, rightTabId?: string, direction: SplitDirection = 'horizontal'): void {
    if (this.state.active) this.unsplit();

    const tabs = this.tabManager?.getAllTabIds() || [];
    if (tabs.length < 2) return;

    const left = leftTabId;
    const right = rightTabId || tabs.find(id => id !== leftTabId) || '';
    if (!right) return;

    this.state = {
      active: true,
      direction,
      leftTabId: left,
      rightTabId: right,
      ratio: 0.5,
      dragging: false,
    };

    this.layoutSplit();
    this.notifySidebar();

    console.log(`[Astra] 🪟 Split view: ${direction}, ratio: ${this.state.ratio}`);
  }

  /**
   * Exit split view — return to single tab view.
   */
  unsplit(): void {
    if (!this.state.active) return;

    // Remove the right tab from the content view
    const rightTab = this.tabManager?.findTabById(this.state.rightTabId);
    if (rightTab) {
      try { this.mainWindow.contentView.removeChildView(rightTab.view); } catch { /* ok */ }
    }

    this.state = {
      active: false,
      direction: 'horizontal',
      leftTabId: '',
      rightTabId: '',
      ratio: 0.5,
      dragging: false,
    };

    // Re-layout to single tab
    this.tabManager?.layout();
    this.notifySidebar();

    console.log(`[Astra] 🪟 Split view closed`);
  }

  /** Toggle split direction */
  toggleDirection(): void {
    if (!this.state.active) return;
    this.state.direction = this.state.direction === 'horizontal' ? 'vertical' : 'horizontal';
    this.layoutSplit();
    this.notifySidebar();
  }

  /**
   * Handle divider drag to resize panes.
   * Zen uses CSS flex-basis percentages; we calculate directly from mouse position.
   */
  handleDividerDrag(position: number): void {
    if (!this.state.active) return;

    const { width, height } = this.mainWindow.getContentBounds();
    const sidebarWidth = 280; // TODO: get from CompactModeManager
    const contentWidth = width - sidebarWidth;
    const contentHeight = height;

    if (this.state.direction === 'horizontal') {
      const newRatio = Math.max(0.2, Math.min(0.8, (position - sidebarWidth) / contentWidth));
      this.state.ratio = newRatio;
    } else {
      const newRatio = Math.max(0.2, Math.min(0.8, position / contentHeight));
      this.state.ratio = newRatio;
    }

    this.layoutSplit();
  }

  /**
   * Swap the tabs between left and right panes.
   */
  swapPanes(): void {
    if (!this.state.active) return;
    const temp = this.state.leftTabId;
    this.state.leftTabId = this.state.rightTabId;
    this.state.rightTabId = temp;
    this.layoutSplit();
    this.notifySidebar();
  }

  // --------------------------------------------------
  // Layout
  // --------------------------------------------------

  /**
   * Position both WebContentsViews based on split direction and ratio.
   */
  layoutSplit(): void {
    if (!this.state.active) return;

    const leftTab = this.tabManager?.findTabById(this.state.leftTabId);
    const rightTab = this.tabManager?.findTabById(this.state.rightTabId);
    if (!leftTab || !rightTab) return;

    const { width, height } = this.mainWindow.getContentBounds();
    const sidebarWidth = 280;
    const contentWidth = width - sidebarWidth;
    const contentHeight = height;

    // Ensure both views are attached
    try { this.mainWindow.contentView.addChildView(leftTab.view); } catch { /* already added */ }
    try { this.mainWindow.contentView.addChildView(rightTab.view); } catch { /* already added */ }

    if (this.state.direction === 'horizontal') {
      const leftWidth = Math.floor(contentWidth * this.state.ratio) - DIVIDER_SIZE / 2;
      const rightWidth = contentWidth - leftWidth - DIVIDER_SIZE;

      leftTab.view.setBounds({
        x: sidebarWidth,
        y: 0,
        width: Math.max(leftWidth, MIN_PANE_SIZE),
        height: contentHeight,
      });

      rightTab.view.setBounds({
        x: sidebarWidth + leftWidth + DIVIDER_SIZE,
        y: 0,
        width: Math.max(rightWidth, MIN_PANE_SIZE),
        height: contentHeight,
      });
    } else {
      const topHeight = Math.floor(contentHeight * this.state.ratio) - DIVIDER_SIZE / 2;
      const bottomHeight = contentHeight - topHeight - DIVIDER_SIZE;

      leftTab.view.setBounds({
        x: sidebarWidth,
        y: 0,
        width: contentWidth,
        height: Math.max(topHeight, MIN_PANE_SIZE),
      });

      rightTab.view.setBounds({
        x: sidebarWidth,
        y: topHeight + DIVIDER_SIZE,
        width: contentWidth,
        height: Math.max(bottomHeight, MIN_PANE_SIZE),
      });
    }
  }

  // --------------------------------------------------
  // IPC
  // --------------------------------------------------

  private notifySidebar(): void {
    this.sidebarView.webContents.send('split:state', {
      active: this.state.active,
      direction: this.state.direction,
      leftTabId: this.state.leftTabId,
      rightTabId: this.state.rightTabId,
      ratio: this.state.ratio,
    });
  }
}
