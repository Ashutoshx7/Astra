import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Zen-style sidebar resize.
 *
 * Key differences from the old approach:
 * - Width is stored on document.documentElement as --astra-sidebar-width
 *   so the CSS layout never needs to touch the sidebar element directly.
 * - The handle is positioned via CSS (right: 0, absolute inside sidebar)
 *   but we listen on `document` so dragging outside the handle still works.
 * - Min/max clamping matches Zen: 180 px min, 600 px max.
 * - Width is persisted to localStorage (equivalent to Zen's Services.prefs).
 * - A "snap-to-collapsed" threshold at 200 px (like Zen's compact mode).
 */

const STORAGE_KEY = 'astra-sidebar-width';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const SNAP_THRESHOLD = 210; // below this → snap back to MIN_WIDTH

function saveWidth(w: number) {
  try { localStorage.setItem(STORAGE_KEY, String(w)); } catch {}
}

function loadWidth(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) {
      const n = parseInt(v, 10);
      if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n;
    }
  } catch {}
  return DEFAULT_WIDTH;
}

function applyWidth(w: number) {
  document.documentElement.style.setProperty('--astra-sidebar-width', `${w}px`);
}

export function useSidebarResize() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Apply persisted width on mount
  useEffect(() => {
    applyWidth(loadWidth());
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = sidebarRef.current
      ? sidebarRef.current.getBoundingClientRect().width
      : loadWidth();

    setIsResizing(true);

    // Lock cursor globally — prevents flicker when mouse leaves sidebar edge
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.body.style.pointerEvents = 'none'; // Zen trick: block hover states during drag

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      let newWidth = startWidth + delta;

      // Snap to min if dragged too narrow
      if (newWidth < SNAP_THRESHOLD) newWidth = MIN_WIDTH;
      else newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth));

      applyWidth(newWidth);
      // Tell the main process so the BrowserView can be repositioned
      window.astra.resizeSidebar(newWidth);
    };

    const onMouseUp = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      let finalWidth = startWidth + delta;
      if (finalWidth < SNAP_THRESHOLD) finalWidth = MIN_WIDTH;
      else finalWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, finalWidth));

      applyWidth(finalWidth);
      saveWidth(finalWidth);

      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.pointerEvents = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return { sidebarRef, isResizing, handleResizeMouseDown };
}
