import React from 'react';
import type { SpaceData } from '../types/renderer';

interface SpaceContextMenuProps {
  x: number;
  y: number;
  spaceId: string;
  spaces: SpaceData[];
  onClose: () => void;
}

const SpaceContextMenu: React.FC<SpaceContextMenuProps> = ({
  x, y, spaceId, spaces, onClose,
}) => (
  <div
    className="space-context-menu"
    style={{ bottom: `calc(100vh - ${y}px)`, left: x }}
    onClick={(e) => e.stopPropagation()}
  >
    <button
      className="space-context-item"
      onClick={() => {
        const name = prompt(
          'Rename workspace:',
          spaces.find((s) => s.id === spaceId)?.name
        );
        if (name) window.astra.renameSpace(spaceId, name);
        onClose();
      }}
    >
      ✏️ Rename
    </button>
    <button
      className="space-context-item"
      onClick={() => {
        const color = prompt(
          'Enter color (hex):',
          spaces.find((s) => s.id === spaceId)?.color
        );
        if (color) window.astra.updateSpaceColor(spaceId, color);
        onClose();
      }}
    >
      🎨 Change Color
    </button>
    {spaces.length > 1 && (
      <button
        className="space-context-item danger"
        onClick={() => {
          if (confirm('Delete this workspace? Tabs will move to another workspace.')) {
            window.astra.deleteSpace(spaceId);
          }
          onClose();
        }}
      >
        🗑️ Delete
      </button>
    )}
  </div>
);

export default SpaceContextMenu;
