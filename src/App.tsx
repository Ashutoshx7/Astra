import React, { useState, useEffect, useRef, useCallback } from 'react';

// --------------------------------------------------
// Type declarations for window.astra
// --------------------------------------------------

declare global {
  interface Window {
    astra: {
      navigate: (url: string) => void;
      goBack: () => void;
      goForward: () => void;
      refresh: () => void;
      newTab: (url?: string) => void;
      closeTab: (tabId: string) => void;
      switchTab: (tabId: string) => void;
      requestTabs: () => void;
      searchSuggestions: (query: string) => void;
      addBookmark: (url: string, title: string) => void;
      removeBookmark: (url: string) => void;
      getBookmarks: () => void;
      onTabsUpdated: (cb: (data: any) => void) => void;
      onUrlChanged: (cb: (url: string) => void) => void;
      onFocusUrlBar: (cb: () => void) => void;
      onSuggestions: (cb: (suggestions: UrlSuggestion[]) => void) => void;
      onBookmarkStatus: (cb: (isBookmarked: boolean) => void) => void;
      onBookmarksResult: (cb: (bookmarks: Bookmark[]) => void) => void;
      onDownloadUpdated: (cb: (download: DownloadItem) => void) => void;
    };
  }
}

interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
  isLoading: boolean;
  isSecure: boolean;
}

interface UrlSuggestion {
  url: string;
  title: string;
  type: 'history' | 'bookmark';
}

interface Bookmark {
  id: number;
  url: string;
  title: string;
  createdAt: number;
}

interface DownloadItem {
  id: string;
  filename: string;
  url: string;
  totalBytes: number;
  receivedBytes: number;
  state: 'progressing' | 'completed' | 'cancelled' | 'interrupted';
}

// --------------------------------------------------
// App Component
// --------------------------------------------------

const App: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [suggestions, setSuggestions] = useState<UrlSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --------------------------------------------------
  // IPC Listeners — run once on mount
  // --------------------------------------------------

  useEffect(() => {
    window.astra.onTabsUpdated((data) => {
      setTabs(data.tabs);
      setActiveTabId(data.activeTabId || '');
    });

    window.astra.onUrlChanged((url) => setUrlInput(url));
    window.astra.onFocusUrlBar(() => {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    });

    window.astra.onSuggestions((results) => {
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    });

    window.astra.onBookmarkStatus((status) => setIsBookmarked(status));
    window.astra.onBookmarksResult((results) => setBookmarks(results));

    window.astra.onDownloadUpdated((download) => {
      setDownloads(prev => {
        const existing = prev.findIndex(d => d.id === download.id);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = download;
          return updated;
        }
        return [...prev, download];
      });
    });

    window.astra.requestTabs();
  }, []);

  // --------------------------------------------------
  // URL bar handlers
  // --------------------------------------------------

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    window.astra.navigate(urlInput);
    setShowSuggestions(false);
    urlInputRef.current?.blur();
  };

  const handleUrlInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUrlInput(value);

    // Debounced suggestion search (300ms)
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (value.length >= 2) {
        window.astra.searchSuggestions(value);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);
  }, []);

  const handleSuggestionClick = (url: string) => {
    setUrlInput(url);
    window.astra.navigate(url);
    setShowSuggestions(false);
  };

  const toggleBookmark = () => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!activeTab) return;

    if (isBookmarked) {
      window.astra.removeBookmark(activeTab.url);
    } else {
      window.astra.addBookmark(activeTab.url, activeTab.title);
    }
  };

  const toggleBookmarksList = () => {
    if (!showBookmarks) window.astra.getBookmarks();
    setShowBookmarks(!showBookmarks);
  };

  // Get the active tab for HTTPS indicator
  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeDownloads = downloads.filter(d => d.state === 'progressing');

  return (
    <div className="sidebar">
      {/* URL Bar */}
      <div className="url-bar">
        <div className="nav-buttons">
          <button className="nav-btn" title="Back" onClick={() => window.astra.goBack()}>←</button>
          <button className="nav-btn" title="Forward" onClick={() => window.astra.goForward()}>→</button>
          <button className="nav-btn" title="Refresh" onClick={() => window.astra.refresh()}>↻</button>
        </div>
        <form onSubmit={handleNavigate} className="url-form">
          <div className="url-input-wrapper">
            {/* HTTPS Indicator */}
            <span className={`security-icon ${activeTab?.isSecure ? 'secure' : 'insecure'}`}>
              {activeTab?.isSecure ? '🔒' : '🔓'}
            </span>
            <input
              ref={urlInputRef}
              className="url-input"
              type="text"
              value={urlInput}
              onChange={handleUrlInputChange}
              onFocus={() => {
                urlInputRef.current?.select();
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search or enter URL..."
              spellCheck={false}
            />
            {/* Bookmark toggle button */}
            <button
              type="button"
              className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
              onClick={toggleBookmark}
              title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          </div>

          {/* URL Suggestions dropdown */}
          {showSuggestions && (
            <div className="suggestions" ref={suggestionsRef}>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="suggestion-item"
                  onMouseDown={() => handleSuggestionClick(s.url)}
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

      {/* Loading Bar */}
      {activeTab?.isLoading && (
        <div className="loading-bar">
          <div className="loading-bar-progress" />
        </div>
      )}

      {/* Tab List */}
      <div className="tab-list">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => window.astra.switchTab(tab.id)}
          >
            <span className="tab-favicon">
              {tab.isLoading ? <span className="spinner">⟳</span> : tab.favicon}
            </span>
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => { e.stopPropagation(); window.astra.closeTab(tab.id); }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Downloads */}
      {activeDownloads.length > 0 && (
        <div className="downloads-section">
          {activeDownloads.map(dl => (
            <div key={dl.id} className="download-item">
              <span className="download-icon">📥</span>
              <div className="download-info">
                <span className="download-name">{dl.filename}</span>
                <div className="download-progress-bar">
                  <div
                    className="download-progress-fill"
                    style={{ width: dl.totalBytes > 0
                      ? `${(dl.receivedBytes / dl.totalBytes) * 100}%`
                      : '0%'
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bookmarks panel */}
      <div className="sidebar-actions">
        <button className="action-btn" onClick={toggleBookmarksList}>
          {showBookmarks ? '✕ Close' : '⭐ Bookmarks'}
        </button>
      </div>

      {showBookmarks && (
        <div className="bookmarks-panel">
          {bookmarks.length === 0 ? (
            <div className="bookmarks-empty">No bookmarks yet. Press Ctrl+D to add one!</div>
          ) : (
            bookmarks.map(b => (
              <div
                key={b.id}
                className="bookmark-item"
                onClick={() => { window.astra.navigate(b.url); setShowBookmarks(false); }}
              >
                <span className="bookmark-item-icon">⭐</span>
                <div className="bookmark-item-text">
                  <span className="bookmark-item-title">{b.title || b.url}</span>
                  <span className="bookmark-item-url">{b.url}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="btn-new-tab" onClick={() => window.astra.newTab()}>
          + New Tab
        </button>
      </div>
    </div>
  );
};

export default App;
