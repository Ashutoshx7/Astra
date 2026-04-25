import React from 'react';
import type { Tab } from '../types/renderer';
import Favicon from './Favicon';

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  index: number;
  onSwitch: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

const TabItem = React.memo<TabItemProps>(({
  tab, isActive, index, onSwitch, onPin, onClose,
  onDragStart, onDragOver, onDrop,
}) => (
  <div
    className={`tab ${isActive ? 'active' : ''} ${tab.isHibernated ? 'hibernated' : ''}`}
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    onClick={() => onSwitch(tab.id)}
  >
    <span className="tab-favicon">
      <Favicon src={tab.favicon} isLoading={tab.isLoading} />
    </span>
    <span className="tab-title" title={tab.title}>{tab.title}</span>
    <div className="tab-actions">
      <button
        className="tab-pin"
        onClick={(e) => { e.stopPropagation(); onPin(tab.id); }}
        title="Pin tab"
      >
        📌
      </button>
      <button
        className="tab-close"
        onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
      >
        ×
      </button>
    </div>
  </div>
));

TabItem.displayName = 'TabItem';

export default TabItem;
