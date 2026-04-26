import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Sidebar resize for Electron BrowserView architecture.
 *
 * KEY DESIGN: No requestAnimationFrame throttle during drag.
 * Every mousemove fires IPC directly. The main process only calls
 * setBounds on the CONTENT view (not the sidebar), so there's only
 * one async GPU operation per frame — no compositor desync.
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

  // On mount: restore saved width
  useEffect(() => {
    const saved = loadWidth();
    window.astra.resizeSidebar(saved);
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = sidebarRef.current
      ? sidebarRef.current.getBoundingClientRect().width
      : loadWidth();

    setIsResizing(true);
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';

    let lastWidth = startWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX;
      const clamped = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + delta));
      if (clamped === lastWidth) return;
      lastWidth = clamped;
      // Direct IPC — no rAF. Main process only moves ONE view (content),
      // so the GPU cost per call is minimal.
      window.astra.resizeSidebar(clamped);
    };

    const onMouseUp = () => {
      // Final authoritative call + persist
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
