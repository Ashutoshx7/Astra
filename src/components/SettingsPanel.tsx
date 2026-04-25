import React from 'react';
import type { Bookmark, HistoryEntry, SettingsSubPanel } from '../types/renderer';

interface SettingsPanelProps {
  subPanel: SettingsSubPanel;
  bookmarks: Bookmark[];
  history: HistoryEntry[];
  onSubPanel: (p: SettingsSubPanel) => void;
  onNavigate: (url: string) => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  subPanel, bookmarks, history, onSubPanel, onNavigate,
}) => (
  <div className="list-panel settings">
    {subPanel === 'main' && (
      <>
        <div className="panel-header">
          <h3>Settings</h3>
        </div>

        <div className="settings-quick-access">
          <button
            className="settings-quick-btn"
            onClick={() => { window.astra.getBookmarks(); onSubPanel('bookmarks'); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <span>Bookmarks</span>
            <span className="settings-quick-chevron">›</span>
          </button>
          <button
            className="settings-quick-btn"
            onClick={() => { window.astra.getHistory(); onSubPanel('history'); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>History</span>
            <span className="settings-quick-chevron">›</span>
          </button>
        </div>

        <div className="setting-group">
          <label>Search Engine</label>
          <select defaultValue="google">
            <option value="google">Google</option>
            <option value="duckduckgo">DuckDuckGo</option>
            <option value="bing">Bing</option>
          </select>
        </div>
        <div className="setting-group">
          <label>Appearance</label>
          <div className="setting-info">Theme: Astra Dark (Default)</div>
        </div>
        <div className="setting-group">
          <label>Ad Blocker</label>
          <div className="setting-info">Status: Enabled 🛡️</div>
        </div>
        <div className="setting-group">
          <label>Fingerprint Guard</label>
          <div className="setting-info">Status: Active 🔒</div>
          <div className="setting-info sub">Canvas noise · WebGL spoofing · Referrer trimming</div>
        </div>
        <div className="setting-group">
          <label>Keyboard Shortcuts</label>
          <div className="setting-info" style={{ fontSize: '11px', lineHeight: '1.8' }}>
            Ctrl+T — New tab<br/>
            Ctrl+S — Toggle compact mode<br/>
            Ctrl+Shift+S — Split view<br/>
            Ctrl+Shift+C — Copy URL<br/>
            Ctrl+Alt+←/→ — Switch workspace<br/>
            Escape — Close glance/find
          </div>
        </div>
        <div className="setting-group">
          <label>Bangs</label>
          <div className="setting-info" style={{ fontSize: '11px', lineHeight: '1.8' }}>
            !g Google · !yt YouTube · !gh GitHub<br/>
            !w Wikipedia · !so Stack Overflow<br/>
            !mdn MDN · !npm npm · !r Reddit<br/>
            <span className="setting-hint">Works anywhere in query: "react !mdn hooks"</span>
          </div>
        </div>
      </>
    )}

    {subPanel === 'bookmarks' && (
      <>
        <div className="panel-header">
          <button className="panel-back-btn" onClick={() => onSubPanel('main')}>←</button>
          <h3>Bookmarks</h3>
        </div>
        {bookmarks.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            </span>
            <p>No bookmarks yet</p>
            <span className="empty-state-hint">Press the star icon on any page to bookmark it</span>
          </div>
        ) : bookmarks.map((b) => (
          <div key={b.id} className="list-item" onClick={() => onNavigate(b.url)}>
            <span className="list-item-icon">⭐</span>
            <div className="list-item-text">
              <div className="list-item-title">{b.title || b.url}</div>
              <div className="list-item-url">{b.url}</div>
            </div>
          </div>
        ))}
      </>
    )}

    {subPanel === 'history' && (
      <>
        <div className="panel-header">
          <button className="panel-back-btn" onClick={() => onSubPanel('main')}>←</button>
          <h3>History</h3>
          <button className="clear-btn" onClick={() => window.astra.clearHistory()}>
            Clear All
          </button>
        </div>
        {history.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            </span>
            <p>No history yet</p>
            <span className="empty-state-hint">Your browsing history will appear here</span>
          </div>
        ) : history.map((h) => (
          <div key={h.id} className="list-item" onClick={() => onNavigate(h.url)}>
            <span className="list-item-icon">🕐</span>
            <div className="list-item-text">
              <div className="list-item-title">{h.title || h.url}</div>
              <div className="list-item-url">{h.url}</div>
            </div>
          </div>
        ))}
      </>
    )}
  </div>
);

export default SettingsPanel;
