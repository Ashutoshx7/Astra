import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// --------------------------------------------------
// Type declarations
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
      pinTab: (tabId: string) => void;
      unpinTab: (tabId: string) => void;
      searchSuggestions: (query: string) => void;
      addBookmark: (url: string, title: string) => void;
      removeBookmark: (url: string) => void;
      getBookmarks: () => void;
      findInPage: (text: string) => void;
      stopFind: () => void;
      onTabsUpdated: (cb: (data: any) => void) => void;
      onUrlChanged: (cb: (url: string) => void) => void;
      onFocusUrlBar: (cb: () => void) => void;
      onSuggestions: (cb: (s: UrlSuggestion[]) => void) => void;
      onBookmarkStatus: (cb: (b: boolean) => void) => void;
      onBookmarksResult: (cb: (b: Bookmark[]) => void) => void;
      onDownloadUpdated: (cb: (d: DownloadItem) => void) => void;
      onFindResult: (cb: (r: FindResult | null) => void) => void;
      onShowFindBar: (cb: () => void) => void;
      onZoomChanged: (cb: (z: number) => void) => void;
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
  isPinned: boolean;
  zoomLevel: number;
}

interface UrlSuggestion { url: string; title: string; type: 'history' | 'bookmark'; }
interface Bookmark { id: number; url: string; title: string; createdAt: number; }
interface DownloadItem { id: string; filename: string; url: string; totalBytes: number; receivedBytes: number; state: string; }
interface FindResult { activeMatchOrdinal: number; matches: number; }

// --------------------------------------------------
// Favicon — memoized to prevent re-renders when parent state changes
// --------------------------------------------------

const Favicon = React.memo<{ src: string; isLoading: boolean }>(({ src, isLoading }) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state when favicon URL changes
  useEffect(() => { setImgError(false); }, [src]);

  if (isLoading) return <span className="spinner">⟳</span>;
  if (src.startsWith('http') && !imgError) {
    return <img src={src} className="favicon-img" onError={() => setImgError(true)} alt="" loading="lazy" />;
  }
  return <span>{src || '🌐'}</span>;
});

Favicon.displayName = 'Favicon';

// --------------------------------------------------
// TabItem — memoized to prevent full list re-render
// --------------------------------------------------

const TabItem = React.memo<{
  tab: Tab;
  isActive: boolean;
  onSwitch: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
}>(({ tab, isActive, onSwitch, onPin, onClose }) => (
  <div
    className={`tab ${isActive ? 'active' : ''}`}
    onClick={() => onSwitch(tab.id)}
  >
    <span className="tab-favicon">
      <Favicon src={tab.favicon} isLoading={tab.isLoading} />
    </span>
    <span className="tab-title">{tab.title}</span>
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

// --------------------------------------------------
// PinnedTab — memoized
// --------------------------------------------------

const PinnedTab = React.memo<{
  tab: Tab;
  isActive: boolean;
  onSwitch: (id: string) => void;
  onUnpin: (id: string) => void;
}>(({ tab, isActive, onSwitch, onUnpin }) => (
  <div
    className={`tab pinned ${isActive ? 'active' : ''}`}
    onClick={() => onSwitch(tab.id)}
    onContextMenu={() => onUnpin(tab.id)}
    title={`${tab.title} (right-click to unpin)`}
  >
    <span className="tab-favicon">
      <Favicon src={tab.favicon} isLoading={tab.isLoading} />
    </span>
  </div>
));

PinnedTab.displayName = 'PinnedTab';

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
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFindBar, setShowFindBar] = useState(false);
  const [findText, setFindText] = useState('');
  const [findResult, setFindResult] = useState<FindResult | null>(null);

  const urlInputRef = useRef<HTMLInputElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --------------------------------------------------
  // Stable callback refs (prevent child re-renders)
  // --------------------------------------------------

  const switchTab = useCallback((id: string) => window.astra.switchTab(id), []);
  const pinTab = useCallback((id: string) => window.astra.pinTab(id), []);
  const unpinTab = useCallback((id: string) => window.astra.unpinTab(id), []);
  const closeTab = useCallback((id: string) => window.astra.closeTab(id), []);

  // --------------------------------------------------
  // IPC Listeners — run once
  // --------------------------------------------------

  useEffect(() => {
    window.astra.onTabsUpdated((data) => {
      setTabs(data.tabs);
      setActiveTabId(data.activeTabId || '');
    });

    window.astra.onUrlChanged((url) => setUrlInput(url));
    window.astra.onFocusUrlBar(() => { urlInputRef.current?.focus(); urlInputRef.current?.select(); });
    window.astra.onSuggestions((r) => { setSuggestions(r); setShowSuggestions(r.length > 0); });
    window.astra.onBookmarkStatus((s) => setIsBookmarked(s));
    window.astra.onBookmarksResult((r) => setBookmarks(r));
    window.astra.onZoomChanged((z) => setZoomLevel(z));

    window.astra.onShowFindBar(() => {
      setShowFindBar(true);
      setTimeout(() => findInputRef.current?.focus(), 50);
    });

    window.astra.onFindResult((r) => {
      if (r === null) { setShowFindBar(false); setFindText(''); setFindResult(null); }
      else setFindResult(r);
    });

    window.astra.onDownloadUpdated((dl) => {
      setDownloads(prev => {
        const i = prev.findIndex(d => d.id === dl.id);
        if (i >= 0) { const u = [...prev]; u[i] = dl; return u; }
        return [...prev, dl];
      });
    });

    window.astra.requestTabs();
  }, []);

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------

  const handleNavigate = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    window.astra.navigate(urlInput);
    setShowSuggestions(false);
    urlInputRef.current?.blur();
  }, [urlInput]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (val.length >= 2) window.astra.searchSuggestions(val);
      else { setSuggestions([]); setShowSuggestions(false); }
    }, 300);
  }, []);

  const closeFindBar = useCallback(() => {
    setShowFindBar(false);
    setFindText('');
    setFindResult(null);
    window.astra.stopFind();
  }, []);

  const toggleBookmark = useCallback(() => {
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    if (isBookmarked) window.astra.removeBookmark(tab.url);
    else window.astra.addBookmark(tab.url, tab.title);
  }, [tabs, activeTabId, isBookmarked]);

  // --------------------------------------------------
  // Memoized derived state (avoid recomputing on every render)
  // --------------------------------------------------

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const pinnedTabs = useMemo(() => tabs.filter(t => t.isPinned), [tabs]);
  const unpinnedTabs = useMemo(() => tabs.filter(t => !t.isPinned), [tabs]);
  const activeDownloads = useMemo(() => downloads.filter(d => d.state === 'progressing'), [downloads]);

  return (
    <div className="sidebar">
      {/* URL Bar */}
      <div className="url-bar">
        <div className="nav-buttons">
          <button className="nav-btn" title="Back" onClick={() => window.astra.goBack()}>←</button>
          <button className="nav-btn" title="Forward" onClick={() => window.astra.goForward()}>→</button>
          <button className="nav-btn" title="Refresh" onClick={() => window.astra.refresh()}>↻</button>
          {zoomLevel !== 100 && <span className="zoom-indicator">{zoomLevel}%</span>}
        </div>
        <form onSubmit={handleNavigate} className="url-form">
          <div className="url-input-wrapper">
            <span className={`security-icon ${activeTab?.isSecure ? 'secure' : 'insecure'}`}>
              {activeTab?.isSecure ? '🔒' : '🔓'}
            </span>
            <input
              ref={urlInputRef}
              className="url-input"
              type="text"
              value={urlInput}
              onChange={handleUrlChange}
              onFocus={() => { urlInputRef.current?.select(); if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Search or enter URL..."
              spellCheck={false}
            />
            <button
              type="button"
              className={`bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
              onClick={toggleBookmark}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          </div>

          {showSuggestions && (
            <div className="suggestions">
              {suggestions.map((s, i) => (
                <div key={i} className="suggestion-item" onMouseDown={() => { setUrlInput(s.url); window.astra.navigate(s.url); setShowSuggestions(false); }}>
                  <span className="suggestion-icon">{s.type === 'bookmark' ? '⭐' : '🕐'}</span>
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

      {/* Find Bar */}
      {showFindBar && (
        <div className="find-bar">
          <form onSubmit={(e) => { e.preventDefault(); if (findText) window.astra.findInPage(findText); }} className="find-form">
            <input
              ref={findInputRef}
              className="find-input"
              type="text"
              value={findText}
              onChange={(e) => { setFindText(e.target.value); if (e.target.value) window.astra.findInPage(e.target.value); }}
              placeholder="Find in page..."
              spellCheck={false}
            />
            {findResult && <span className="find-count">{findResult.activeMatchOrdinal}/{findResult.matches}</span>}
            <button type="button" className="find-close" onClick={closeFindBar}>✕</button>
          </form>
        </div>
      )}

      {/* Loading Bar */}
      {activeTab?.isLoading && <div className="loading-bar"><div className="loading-bar-progress" /></div>}

      {/* Pinned Tabs */}
      {pinnedTabs.length > 0 && (
        <div className="pinned-tabs">
          {pinnedTabs.map(tab => (
            <PinnedTab key={tab.id} tab={tab} isActive={tab.id === activeTabId} onSwitch={switchTab} onUnpin={unpinTab} />
          ))}
        </div>
      )}

      {/* Tab List */}
      <div className="tab-list">
        {unpinnedTabs.map(tab => (
          <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} onSwitch={switchTab} onPin={pinTab} onClose={closeTab} />
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
                  <div className="download-progress-fill" style={{ width: dl.totalBytes > 0 ? `${(dl.receivedBytes / dl.totalBytes) * 100}%` : '0%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Bookmarks */}
      <div className="sidebar-actions">
        <button className="action-btn" onClick={() => { if (!showBookmarks) window.astra.getBookmarks(); setShowBookmarks(!showBookmarks); }}>
          {showBookmarks ? '✕ Close' : '⭐ Bookmarks'}
        </button>
      </div>

      {showBookmarks && (
        <div className="bookmarks-panel">
          {bookmarks.length === 0 ? (
            <div className="bookmarks-empty">No bookmarks yet. Press Ctrl+D to add one!</div>
          ) : (
            bookmarks.map(b => (
              <div key={b.id} className="bookmark-item" onClick={() => { window.astra.navigate(b.url); setShowBookmarks(false); }}>
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
        <button className="btn-new-tab" onClick={() => window.astra.newTab()}>+ New Tab</button>
      </div>
    </div>
  );
};

export default App;
