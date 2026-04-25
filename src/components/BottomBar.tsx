import React from 'react';
import type { SpaceData, PanelMode } from '../types/renderer';

interface BottomBarProps {
  spaces: SpaceData[];
  activeSpaceId: string;
  panelMode: PanelMode;
  onOpenSettings: () => void;
  onSwitchSpace: (id: string) => void;
  onSpaceContextMenu: (e: React.MouseEvent, spaceId: string) => void;
  onCreateSpace: () => void;
}

const BottomBar: React.FC<BottomBarProps> = ({
  spaces, activeSpaceId, panelMode,
  onOpenSettings, onSwitchSpace, onSpaceContextMenu, onCreateSpace,
}) => (
  <div className="sidebar-bottom-bar">
    {/* Settings button */}
    <button
      className={`bottom-bar-settings ${panelMode === 'settings' ? 'active' : ''}`}
      onClick={onOpenSettings}
      title="Settings"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
    </button>

    {/* Space dots */}
    <div className="bottom-bar-spaces">
      {spaces.map((space) => (
        <div
          key={space.id}
          className={`space-icon ${space.id === activeSpaceId ? 'active' : ''}`}
          style={{ '--space-color': space.color } as React.CSSProperties}
          onClick={() => onSwitchSpace(space.id)}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onSpaceContextMenu(e, space.id); }}
          title={space.name}
        >
          {space.icon}
        </div>
      ))}
    </div>

    {/* New workspace */}
    <button
      className="bottom-bar-add"
      onClick={onCreateSpace}
      title="New Workspace"
    >
      +
    </button>
  </div>
);

export default BottomBar;
