import React, { useState, useEffect } from 'react';

/**
 * WindowControls — Zen-style custom window control buttons.
 *
 * Replaces native titleBarOverlay with custom SVG buttons that:
 * - Float in the top-right corner of the sidebar
 * - Auto-hide when not hovered (opacity → 0)
 * - Show on hover with smooth transition
 * - Integrate visually with the sidebar background
 *
 * Zen's approach (zen-browser-ui.css, line 237):
 *   &:not([zen-has-hover="true"]) > .titlebar-buttonbox { opacity: 0; }
 */
const WindowControls: React.FC = () => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.astra.onMaximizedChanged((max: boolean) => setIsMaximized(max));
  }, []);

  return (
    <div className="window-controls">
      {/* Minimize */}
      <button
        className="window-control-btn minimize-btn"
        onClick={() => window.astra.minimizeWindow()}
        title="Minimize"
        aria-label="Minimize"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      {/* Maximize / Restore */}
      <button
        className="window-control-btn maximize-btn"
        onClick={() => window.astra.maximizeWindow()}
        title={isMaximized ? 'Restore' : 'Maximize'}
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
      >
        {isMaximized ? (
          /* Restore icon — two overlapping rectangles */
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="2" y="0" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
            <rect x="0" y="2" width="8" height="8" rx="1" fill="var(--astra-bg)" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          /* Maximize icon — single rectangle */
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0" y="0" width="10" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
          </svg>
        )}
      </button>

      {/* Close */}
      <button
        className="window-control-btn close-btn"
        onClick={() => window.astra.closeWindow()}
        title="Close"
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.2" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
};

export default WindowControls;
