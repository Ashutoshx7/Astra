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
        className="tab-close"
        onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
        title="Close tab"
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="4" x2="12" y2="12"/>
          <line x1="12" y1="4" x2="4" y2="12"/>
        </svg>
      </button>
    </div>
  </div>
));

TabItem.displayName = 'TabItem';

export default TabItem;
