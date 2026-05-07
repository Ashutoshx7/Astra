import React from 'react';
import type { Tab } from '../types/renderer';
import TabItem from './TabItem';

interface TabListProps {
  unpinnedTabs: (Tab & { originalIndex: number })[];
  activeTabId: string;
  onSwitch: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number, tabId: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
  onDropToUnpinZone: (e: React.DragEvent) => void;
}

const TabList: React.FC<TabListProps> = ({
  unpinnedTabs, activeTabId, onSwitch, onPin, onClose,
  onDragStart, onDragOver, onDrop, onDropToUnpinZone,
}) => (
  <div
    className="tab-list"
    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
    onDrop={onDropToUnpinZone}
  >
    {unpinnedTabs.map((t) => (
      <TabItem
        key={t.id}
        tab={t}
        index={t.originalIndex}
        isActive={t.id === activeTabId}
        onSwitch={onSwitch}
        onPin={onPin}
        onClose={onClose}
        onDragStart={(e, idx) => onDragStart(e, idx, t.id)}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />
    ))}
    {/* Zen-style new tab button — transparent bg, + icon */}
    <div className="tab new-tab-inline" onClick={() => window.astra.newTab()}>
      <span className="tab-favicon new-tab-icon">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="8" y1="3" x2="8" y2="13"/>
          <line x1="3" y1="8" x2="13" y2="8"/>
        </svg>
      </span>
      <span className="tab-title">New Tab</span>
    </div>
  </div>
);

export default TabList;
