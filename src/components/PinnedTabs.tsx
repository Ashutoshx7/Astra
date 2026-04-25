import React from 'react';
import type { Tab } from '../types/renderer';
import PinnedTab from './PinnedTab';

interface PinnedTabsProps {
  pinnedTabs: (Tab & { originalIndex: number })[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onUnpin: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number, tabId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDropToPinZone: (e: React.DragEvent) => void;
}

const PinnedTabs: React.FC<PinnedTabsProps> = ({
  pinnedTabs, activeTabId, onSwitch, onUnpin,
  onDragStart, onDragOver, onDrop, onDropToPinZone,
}) => (
  <div
    className={`pinned-tabs ${pinnedTabs.length === 0 ? 'pinned-tabs-empty' : ''}`}
    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
    onDrop={onDropToPinZone}
  >
    {pinnedTabs.length > 0 ? (
      <>
        <div className="pinned-tabs-label">Pinned</div>
        <div className="pinned-tabs-grid">
          {pinnedTabs.map((t) => (
            <PinnedTab
              key={t.id}
              tab={t}
              index={t.originalIndex}
              isActive={t.id === activeTabId}
              onSwitch={onSwitch}
              onUnpin={onUnpin}
              onDragStart={(e, idx) => onDragStart(e, idx, t.id)}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      </>
    ) : (
      <div className="pinned-tabs-drop-hint">Drop tabs here to pin</div>
    )}
  </div>
);

export default PinnedTabs;
