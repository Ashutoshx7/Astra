import React from 'react';
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
      {/* Zen-style toolbar row */}
      <div className="nav-buttons">
        <div className="nav-group-left">
          <button className="nav-btn" title="Menu" id="nav-menu-btn">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="8" r="1.5"/>
              <circle cx="8" cy="8" r="1.5"/>
              <circle cx="13" cy="8" r="1.5"/>
            </svg>
          </button>
          <button className="nav-btn" title="Toggle sidebar" onClick={() => window.astra.toggleCompactMode()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="1.5" y="1.5" width="13" height="13" rx="2.5"/>
              <line x1="6" y1="1.5" x2="6" y2="14.5"/>
            </svg>
          </button>
        </div>
        <div className="nav-group-right">
          {zoomLevel !== 100 && <span className="zoom-indicator">{zoomLevel}%</span>}
          <button className="nav-btn" title="Back" onClick={() => window.astra.goBack()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="10 3 5 8 10 13"/>
            </svg>
          </button>
          <button className="nav-btn" title="Forward" onClick={() => window.astra.goForward()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 3 11 8 6 13"/>
            </svg>
          </button>
          <button className="nav-btn nav-refresh-btn" title="Refresh" onClick={() => window.astra.refresh()}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 6.5A5.5 5.5 0 1 1 11 3.5"/>
              <polyline points="14 2 14 6.5 9.5 6.5"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Zen-style URL pill */}
      <form onSubmit={onNavigate} className="url-form">
        <div className="url-input-wrapper">
          {/* Search/lock icon — left side */}
          <span className="url-icon-left">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5"/>
              <line x1="11" y1="11" x2="14" y2="14"/>
            </svg>
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
            placeholder="Search…"
            spellCheck={false}
          />
          {/* Page actions — only on hover like Zen */}
          <div className="url-page-actions">
            <button
              type="button"
              className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
              onClick={onToggleBookmark}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.3">
                <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v12.207a.5.5 0 0 1-.768.42L8 12.118l-5.232 3.009a.5.5 0 0 1-.768-.42V2.5z"/>
              </svg>
            </button>
          </div>
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((s, i) => (
              <div key={i} className="suggestion-item" onMouseDown={() => onSuggestionPick(s.url)}>
                <span className="suggestion-icon">
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" opacity="0.4">
                    {s.type === 'bookmark' ? (
                      <path d="M2 2.5A1.5 1.5 0 0 1 3.5 1h9A1.5 1.5 0 0 1 14 2.5v12.207a.5.5 0 0 1-.768.42L8 12.118l-5.232 3.009a.5.5 0 0 1-.768-.42V2.5z"/>
                    ) : (
                      <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm.5 3v3.5H12v1H8.5V12h-1V8.5H4v-1h3.5V4h1z"/>
                    )}
                  </svg>
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
