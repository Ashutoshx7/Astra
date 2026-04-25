import React from 'react';
import type { Tab } from '../types/renderer';
import Favicon from './Favicon';

interface PinnedTabProps {
  tab: Tab;
  isActive: boolean;
  index: number;
  onSwitch: (id: string) => void;
  onUnpin: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const PinnedTab = React.memo<PinnedTabProps>(({
  tab, isActive, index, onSwitch, onUnpin,
  onDragStart, onDragOver, onDrop,
}) => (
  <div
    className={`tab pinned ${isActive ? 'active' : ''}`}
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    onClick={() => onSwitch(tab.id)}
    onContextMenu={(e) => { e.preventDefault(); onUnpin(tab.id); }}
    title={`${tab.title} (right-click to unpin)`}
  >
    <span className="tab-favicon">
      <Favicon src={tab.favicon} isLoading={tab.isLoading} />
    </span>
  </div>
));

PinnedTab.displayName = 'PinnedTab';

export default PinnedTab;
