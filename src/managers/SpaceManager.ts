import { randomUUID } from 'node:crypto';
import { WebContentsView } from 'electron';
import { Space, SpaceData, IPC } from '../types';
import { AppDatabase } from '../database/Database';
import type { TabManager } from './TabManager';

/**
 * SpaceManager — Workspace system inspired by Zen Browser's ZenSpaceManager.
 *
 * Key patterns adopted from Zen:
 *   - Safe tab selection with debounce (prevents race conditions)
 *   - Wrap-around workspace navigation
 *   - Per-workspace last-active-tab tracking
 *   - Essential (pinned) tabs persist across all workspaces
 *
 * Architecture:
 *   Spaces are persisted in SQLite. Each tab has a `spaceId`.
 *   Switching spaces hides/shows WebContentsViews and selects
 *   the last-active tab for that space.
 */

// Default workspace colors (matching Zen's gradient palette concept)
const SPACE_COLORS = [
  '#6366f1', // Indigo (default)
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#22c55e', // Green
  '#3b82f6', // Blue
  '#f97316', // Orange
];

const SPACE_ICONS = ['🏠', '💼', '🎨', '📚', '🔬', '🎮', '🎵', '📧', '🛒', '⚡'];

export class SpaceManager {
  private spaces: Space[] = [];
  private activeSpaceId = '';

  // Zen-inspired: track last active tab per workspace for instant switching
  private lastActiveTabPerSpace: Map<string, string> = new Map();

  // Zen-inspired: debounce tab selection to prevent race conditions
  private lastSelectionTime = 0;
  private static readonly SELECTION_DEBOUNCE_MS = 100;

  constructor(
    private readonly database: AppDatabase,
    private readonly sidebarView: WebContentsView,
    private tabManager: TabManager | null = null,
  ) {
    this.initialize();
  }

  // --------------------------------------------------
  // Initialization
  // --------------------------------------------------

  private initialize(): void {
    this.spaces = this.database.getSpaces();

    // Ensure at least one default workspace exists
    if (this.spaces.length === 0) {
      const defaultSpace = this.createDefaultSpace();
      this.spaces.push(defaultSpace);
    }

    this.activeSpaceId = this.spaces[0].id;
    console.log(`[Astra] 🗂️ SpaceManager initialized: ${this.spaces.length} workspace(s)`);
  }

  private createDefaultSpace(): Space {
    const space: Space = {
      id: randomUUID(),
      name: 'Home',
      color: SPACE_COLORS[0],
      icon: SPACE_ICONS[0],
      position: 0,
      createdAt: Date.now(),
    };
    this.database.createSpace(space);
    return space;
  }

  setTabManager(tm: TabManager): void {
    this.tabManager = tm;
  }

  // --------------------------------------------------
  // Public API — Workspace CRUD
  // --------------------------------------------------

  getActiveSpaceId(): string {
    return this.activeSpaceId;
  }

  getSpaces(): SpaceData[] {
    return this.spaces.map(s => ({
      id: s.id,
      name: s.name,
      color: s.color,
      icon: s.icon,
      position: s.position,
    }));
  }

  createSpace(name: string, color?: string, icon?: string): Space {
    const position = this.spaces.length;
    const space: Space = {
      id: randomUUID(),
      name: name || `Space ${position + 1}`,
      color: color || SPACE_COLORS[position % SPACE_COLORS.length],
      icon: icon || SPACE_ICONS[position % SPACE_ICONS.length],
      position,
      createdAt: Date.now(),
    };

    this.database.createSpace(space);
    this.spaces.push(space);
    this.sendSpacesToSidebar();

    console.log(`[Astra] 🗂️ Created workspace: ${space.name} (${space.id})`);
    return space;
  }

  deleteSpace(spaceId: string): void {
    // Cannot delete the last workspace
    if (this.spaces.length <= 1) return;

    const index = this.spaces.findIndex(s => s.id === spaceId);
    if (index === -1) return;

    // Move tabs from deleted space to the first remaining space
    const targetSpaceId = this.spaces.find(s => s.id !== spaceId)!.id;
    this.tabManager?.moveTabsToSpace(spaceId, targetSpaceId);

    this.database.deleteSpace(spaceId);
    this.spaces.splice(index, 1);
    this.lastActiveTabPerSpace.delete(spaceId);

    // Re-index positions
    this.spaces.forEach((s, i) => {
      s.position = i;
      this.database.updateSpacePosition(s.id, i);
    });

    // If deleted the active space, switch to first
    if (this.activeSpaceId === spaceId) {
      this.switchToSpace(this.spaces[0].id);
    }

    this.sendSpacesToSidebar();
    console.log(`[Astra] 🗂️ Deleted workspace: ${spaceId}`);
  }

  renameSpace(spaceId: string, name: string): void {
    const space = this.spaces.find(s => s.id === spaceId);
    if (!space || !name.trim()) return;

    space.name = name.trim();
    this.database.renameSpace(spaceId, space.name);
    this.sendSpacesToSidebar();
  }

  updateSpaceColor(spaceId: string, color: string): void {
    const space = this.spaces.find(s => s.id === spaceId);
    if (!space) return;

    space.color = color;
    this.database.updateSpaceColor(spaceId, color);
    this.sendSpacesToSidebar();
  }

  reorderSpace(spaceId: string, newIndex: number): void {
    const oldIndex = this.spaces.findIndex(s => s.id === spaceId);
    if (oldIndex === -1 || newIndex < 0 || newIndex >= this.spaces.length) return;

    const [space] = this.spaces.splice(oldIndex, 1);
    this.spaces.splice(newIndex, 0, space);

    this.spaces.forEach((s, i) => {
      s.position = i;
      this.database.updateSpacePosition(s.id, i);
    });

    this.sendSpacesToSidebar();
  }

  // --------------------------------------------------
  // Space Switching (Zen's race-condition-safe pattern)
  // --------------------------------------------------

  /**
   * Switch to a workspace. Inspired by Zen's `_safelySelectTab` pattern:
   * - Debounce rapid switches (100ms) to prevent tab flickering
   * - Remember the last active tab per workspace
   * - If no tabs exist in the target space, create a new one
   */
  async switchToSpace(spaceId: string): Promise<void> {
    if (spaceId === this.activeSpaceId) return;

    const space = this.spaces.find(s => s.id === spaceId);
    if (!space) return;

    // Zen-inspired debounce: prevent rapid-fire workspace switches
    const now = Date.now();
    const timeSince = now - this.lastSelectionTime;
    if (timeSince < SpaceManager.SELECTION_DEBOUNCE_MS) {
      await new Promise(resolve =>
        setTimeout(resolve, SpaceManager.SELECTION_DEBOUNCE_MS - timeSince),
      );
    }
    this.lastSelectionTime = Date.now();

    // Save current tab as last-active for the old space
    const currentActiveTab = this.tabManager?.getActiveTabId();
    if (currentActiveTab && this.activeSpaceId) {
      this.lastActiveTabPerSpace.set(this.activeSpaceId, currentActiveTab);
    }

    // Switch
    this.activeSpaceId = spaceId;

    // Find the last active tab in the target space
    const lastTabId = this.lastActiveTabPerSpace.get(spaceId);
    const tabsInSpace = this.tabManager?.getTabsForSpace(spaceId) || [];

    if (tabsInSpace.length === 0) {
      // No tabs in this workspace — create a new one
      const newTab = this.tabManager?.createTab(undefined, false, spaceId);
      if (newTab) this.tabManager?.switchToTab(newTab.id);
    } else if (lastTabId && tabsInSpace.some(t => t.id === lastTabId)) {
      // Restore last active tab
      this.tabManager?.switchToTab(lastTabId);
    } else {
      // Fallback to first tab in space
      this.tabManager?.switchToTab(tabsInSpace[0].id);
    }

    // Notify sidebar
    this.tabManager?.sendTabsToSidebar();
    this.sendSpacesToSidebar();

    console.log(`[Astra] 🗂️ Switched to workspace: ${space.name}`);
  }

  /**
   * Navigate to next workspace (Zen's Ctrl+Alt+Right).
   * Wraps around if at the last workspace (Zen's `wrap-around-navigation` pref).
   */
  switchToNextSpace(): void {
    const currentIndex = this.spaces.findIndex(s => s.id === this.activeSpaceId);
    const nextIndex = (currentIndex + 1) % this.spaces.length;
    this.switchToSpace(this.spaces[nextIndex].id);
  }

  /**
   * Navigate to previous workspace (Zen's Ctrl+Alt+Left).
   */
  switchToPreviousSpace(): void {
    const currentIndex = this.spaces.findIndex(s => s.id === this.activeSpaceId);
    const prevIndex = (currentIndex - 1 + this.spaces.length) % this.spaces.length;
    this.switchToSpace(this.spaces[prevIndex].id);
  }

  // --------------------------------------------------
  // Sidebar communication
  // --------------------------------------------------

  sendSpacesToSidebar(): void {
    this.sidebarView.webContents.send(IPC.SPACES_UPDATED, {
      spaces: this.getSpaces(),
      activeSpaceId: this.activeSpaceId,
    });
  }
}
