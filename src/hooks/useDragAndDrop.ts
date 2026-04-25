import { useCallback, useRef } from 'react';

/**
 * Encapsulates all tab drag-and-drop logic.
 * Returns stable callbacks to pass into tab components.
 */
export function useDragAndDrop() {
  const draggedIndex = useRef<number | null>(null);
  const draggedTabId = useRef<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number, tabId?: string) => {
      draggedIndex.current = index;
      draggedTabId.current = tabId || null;
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((_e: React.DragEvent, dropIndex: number) => {
    if (
      draggedIndex.current !== null &&
      draggedIndex.current !== dropIndex
    ) {
      window.astra.reorderTabs(draggedIndex.current, dropIndex);
    }
    draggedIndex.current = null;
    draggedTabId.current = null;
  }, []);

  const handleDropToPinZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTabId.current) window.astra.pinTab(draggedTabId.current);
    draggedIndex.current = null;
    draggedTabId.current = null;
  }, []);

  const handleDropToUnpinZone = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (draggedTabId.current) window.astra.unpinTab(draggedTabId.current);
    draggedIndex.current = null;
    draggedTabId.current = null;
  }, []);

  return {
    handleDragStart,
    handleDragOver,
    handleDrop,
    handleDropToPinZone,
    handleDropToUnpinZone,
  };
}
