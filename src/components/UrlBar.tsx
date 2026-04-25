import React, { useRef, useCallback } from 'react';
import type { Tab, UrlSuggestion } from '../types/renderer';

interface UrlBarProps {
  activeTab: Tab | undefined;
  urlInput: string;
  zoomLevel: number;
  isBookmarked: boolean;
  suggestions: UrlSuggestion[];
  showSuggestions: boolean;
  onNavigate: (e: React.FormEvent) => void;
  onUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSuggestionPick: (url: string) => void;
  onToggleBookmark: () => void;
  onShowSuggestions: (v: boolean) => void;
  urlInputRef: React.RefObject<HTMLInputElement | null>;
}

const UrlBar: React.FC<UrlBarProps> = ({
  activeTab, urlInput, zoomLevel, isBookmarked,
  suggestions, showSuggestions,
  onNavigate, onUrlChange, onSuggestionPick,
  onToggleBookmark, onShowSuggestions, urlInputRef,
}) => {
  return (
    <div className="url-bar">
      {/* Toolbar row: left = ⋯ + sidebar toggle | right = ← → ↻ */}
      <div className="nav-buttons">
        <div className="nav-group-left">
          <button className="nav-btn" title="Menu" id="nav-menu-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2"/>
              <circle cx="12" cy="12" r="2"/>
              <circle cx="19" cy="12" r="2"/>
            </svg>
          </button>
          <button
            className="nav-btn nav-sidebar-toggle"
            title="Toggle sidebar"
            onClick={() => window.astra.toggleCompactMode()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
        </div>

        <div className="nav-group-right">
          {zoomLevel !== 100 && (
            <span className="zoom-indicator">{zoomLevel}%</span>
          )}
          <button className="nav-btn" title="Back" onClick={() => window.astra.goBack()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button className="nav-btn" title="Forward" onClick={() => window.astra.goForward()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          <button
            className="nav-btn nav-refresh-btn"
            title="Refresh"
            onClick={() => window.astra.refresh()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
          </button>
        </div>
      </div>

      {/* URL input row */}
      <form onSubmit={onNavigate} className="url-form">
        <div className="url-input-wrapper">
          <span className={`security-icon ${activeTab?.isSecure ? 'secure' : 'insecure'}`}>
            {activeTab?.isSecure ? '🔒' : '🔓'}
          </span>
          <input
            ref={urlInputRef}
            className="url-input"
            type="text"
            value={urlInput}
            onChange={onUrlChange}
            onFocus={() => {
              urlInputRef.current?.select();
              if (suggestions.length > 0) onShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => onShowSuggestions(false), 200)}
            placeholder="Search or enter URL..."
            spellCheck={false}
          />
          <button
            type="button"
            className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
            onClick={onToggleBookmark}
            title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          >
            {isBookmarked ? '★' : '☆'}
          </button>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((s, i) => (
              <div
                key={i}
                className="suggestion-item"
                onMouseDown={() => onSuggestionPick(s.url)}
              >
                <span className="suggestion-icon">
                  {s.type === 'bookmark' ? '⭐' : '🕐'}
                </span>
                <div className="suggestion-text">
                  <span className="suggestion-title">{s.title}</span>
                  <span className="suggestion-url">{s.url}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

export default UrlBar;
