import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sidebar resize for Electron BrowserView architecture.
 *
 * CRITICAL: In Electron, the sidebar is a BrowserView whose width is set
 * by the MAIN PROCESS. The sidebar div inside it should always be width:100%.
 *
 * All we do here is:
 * 1. On mount: restore saved width via IPC so main process sets BrowserView size.
 * 2. On drag: send IPC to main process at ~60fps via rAF.
 * 3. On mouseup: save final width to localStorage.
 *
 * We do NOT manipulate any CSS width variables — that would create a mismatch
 * between the CSS layout and the actual BrowserView bounds.
 */

const STORAGE_KEY = 'astra-sidebar-width';
const DEFAULT_WIDTH = 300;
const MIN_WIDTH = 200;
const MAX_WIDTH = 600;

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

export function useSidebarResize() {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // On mount: tell main process what width to use (from localStorage)
  useEffect(() => {
    const saved = loadWidth();
    window.astra.resizeSidebar(saved);
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    // Read current width from the BrowserView bounds (via DOM measurement)
    const startWidth = sidebarRef.current
      ? sidebarRef.current.getBoundingClientRect().width
      : loadWidth();

    setIsResizing(true);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    let rafId = 0;
    let lastWidth = startWidth;

    const onMouseMove = (ev: MouseEvent) => {
      // Capture clientX before rAF — synthetic events get recycled
      const currentX = ev.clientX;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const delta = currentX - startX;
        const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
        if (clamped === lastWidth) return; // skip if nothing changed
        lastWidth = clamped;
        // Only IPC — no CSS manipulation
        window.astra.resizeSidebar(clamped);
      });
    };

    const onMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);

      // Final call with authoritative width
      window.astra.resizeSidebar(lastWidth);
      saveWidth(lastWidth);

      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, []);

  return { sidebarRef, isResizing, handleResizeMouseDown };
}
