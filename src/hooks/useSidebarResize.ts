import { useCallback, useRef, useState } from 'react';

/**
 * Encapsulates sidebar resize mouse logic.
 * Returns a mousedown handler and the resize-handle ref.
 */
export function useSidebarResize() {
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(320);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    const sidebar = sidebarRef.current;
    resizeStartWidth.current = sidebar
      ? sidebar.getBoundingClientRect().width
      : 320;

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - resizeStartX.current;
      const newWidth = Math.max(220, Math.min(600, resizeStartWidth.current + delta));
      window.astra.resizeSidebar(newWidth);
      document.documentElement.style.setProperty('--astra-sidebar-width', `${newWidth}px`);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return { sidebarRef, isResizing, handleResizeMouseDown };
}
