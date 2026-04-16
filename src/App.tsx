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
      reorderTabs: (oldIndex: number, newIndex: number) => void;
      hibernateTab: (tabId: string) => void;
      searchSuggestions: (query: string) => void;
      addBookmark: (url: string, title: string) => void;
      removeBookmark: (url: string) => void;
      getBookmarks: () => void;
      getHistory: () => void;
      clearHistory: () => void;
      findInPage: (text: string) => void;
      stopFind: () => void;
      // Workspaces
      switchSpace: (spaceId: string) => void;
      createSpace: (data: { name: string; color: string; icon: string }) => void;
      deleteSpace: (spaceId: string) => void;
      renameSpace: (spaceId: string, name: string) => void;
      reorderSpaces: (spaceId: string, newIndex: number) => void;
      updateSpaceColor: (spaceId: string, color: string) => void;
      requestSpaces: () => void;
      // Listeners
      onTabsUpdated: (cb: (data: any) => void) => void;
      onUrlChanged: (cb: (url: string) => void) => void;
      onFocusUrlBar: (cb: () => void) => void;
      onSuggestions: (cb: (s: UrlSuggestion[]) => void) => void;
      onBookmarkStatus: (cb: (b: boolean) => void) => void;
      onBookmarksResult: (cb: (b: Bookmark[]) => void) => void;
      onHistoryResult: (cb: (b: HistoryEntry[]) => void) => void;
      onDownloadUpdated: (cb: (d: DownloadItem) => void) => void;
      onFindResult: (cb: (r: FindResult | null) => void) => void;
      onShowFindBar: (cb: () => void) => void;
      onZoomChanged: (cb: (z: number) => void) => void;
      onSpacesUpdated: (cb: (data: { spaces: SpaceData[]; activeSpaceId: string }) => void) => void;
      onUrlCopied: (cb: (url: string) => void) => void;
      // Compact Mode
      toggleCompactMode: () => void;
      setCompactMode: (mode: string) => void;
      reportMouseMove: (x: number, y: number) => void;
      lockPopup: () => void;
      unlockPopup: () => void;
      onCompactState: (cb: (state: { mode: string; sidebarVisible: boolean }) => void) => void;
      // Glance
      openGlance: (url: string, x: number, y: number) => void;
      closeGlance: () => void;
      expandGlance: () => void;
      onGlanceOpened: (cb: (data: { url: string }) => void) => void;
      onGlanceClosed: (cb: () => void) => void;
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
  isHibernated: boolean;
  zoomLevel: number;
  spaceId: string;
}

interface SpaceData {
  id: string;
  name: string;
  color: string;
  icon: string;
  position: number;
}

interface UrlSuggestion { url: string; title: string; type: 'history' | 'bookmark'; }
interface Bookmark { id: number; url: string; title: string; createdAt: number; }
interface HistoryEntry { id: number; url: string; title: string; visitCount: number; lastVisitedAt: number; }
interface DownloadItem { id: string; filename: string; url: string; totalBytes: number; receivedBytes: number; state: string; }
interface FindResult { activeMatchOrdinal: number; matches: number; }

type PanelMode = 'tabs' | 'bookmarks' | 'history' | 'settings';

// --------------------------------------------------
// Favicon — memoized
// --------------------------------------------------

const Favicon = React.memo<{ src: string; isLoading: boolean }>(({ src, isLoading }) => {
  const [imgError, setImgError] = useState(false);
  useEffect(() => { setImgError(false); }, [src]);

  if (isLoading) return <span className="spinner">⟳</span>;
  if (src && src.startsWith('http') && !imgError) {
    return <img src={src} className="favicon-img" onError={() => setImgError(true)} alt="" loading="lazy" />;
  }
  return <span>{src || '🌐'}</span>;
});
Favicon.displayName = 'Favicon';

// --------------------------------------------------
// TabItem — memoized with Drag & Drop support
// --------------------------------------------------

const TabItem = React.memo<{
  tab: Tab;
  isActive: boolean;
  index: number;
  onSwitch: (id: string) => void;
  onPin: (id: string) => void;
  onClose: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}>(({ tab, isActive, index, onSwitch, onPin, onClose, onDragStart, onDragOver, onDrop }) => (
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
      <button className="tab-pin" onClick={(e) => { e.stopPropagation(); onPin(tab.id); }} title="Pin tab">📌</button>
      <button className="tab-close" onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}>×</button>
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
  index: number;
  onSwitch: (id: string) => void;
  onUnpin: (id: string) => void;
  onDragStart: (e: React.DragEvent, index: number) => void;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}>(({ tab, isActive, index, onSwitch, onUnpin, onDragStart, onDragOver, onDrop }) => (
  <div
    className={`tab pinned ${isActive ? 'active' : ''}`}
    draggable
    onDragStart={(e) => onDragStart(e, index)}
    onDragOver={(e) => onDragOver(e, index)}
    onDrop={(e) => onDrop(e, index)}
    onClick={() => onSwitch(tab.id)}
    onContextMenu={(e) => { e.preventDefault(); onUnpin(tab.id); }}
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
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>('tabs');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showFindBar, setShowFindBar] = useState(false);
  const [findText, setFindText] = useState('');
  const [findResult, setFindResult] = useState<FindResult | null>(null);
  const [spaces, setSpaces] = useState<SpaceData[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState('');
  const [urlCopiedToast, setUrlCopiedToast] = useState(false);
  const [spaceContextMenu, setSpaceContextMenu] = useState<{ x: number; y: number; spaceId: string } | null>(null);
  const [compactState, setCompactState] = useState<{ mode: string; sidebarVisible: boolean }>({ mode: 'full', sidebarVisible: true });
  const [glanceState, setGlanceState] = useState<{ active: boolean; url: string }>({ active: false, url: '' });

  const urlInputRef = useRef<HTMLInputElement>(null);
  const findInputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggedIndex = useRef<number | null>(null);

  // --------------------------------------------------
  // Stable callback refs
  // --------------------------------------------------

  const switchTab = useCallback((id: string) => window.astra.switchTab(id), []);
  const pinTab = useCallback((id: string) => window.astra.pinTab(id), []);
  const unpinTab = useCallback((id: string) => window.astra.unpinTab(id), []);
  const closeTab = useCallback((id: string) => window.astra.closeTab(id), []);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    draggedIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((_e: React.DragEvent, dropIndex: number) => {
    if (draggedIndex.current !== null && draggedIndex.current !== dropIndex) {
      window.astra.reorderTabs(draggedIndex.current, dropIndex);
    }
    draggedIndex.current = null;
  }, []);

  // --------------------------------------------------
  // IPC Listeners
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
    window.astra.onHistoryResult((r) => setHistory(r));
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

    // Workspace listeners
    window.astra.onSpacesUpdated((data) => {
      setSpaces(data.spaces);
      setActiveSpaceId(data.activeSpaceId);
    });

    window.astra.onUrlCopied(() => {
      setUrlCopiedToast(true);
      setTimeout(() => setUrlCopiedToast(false), 1800);
    });

    // Compact mode listeners
    window.astra.onCompactState((state) => setCompactState(state));

    // Glance listeners
    window.astra.onGlanceOpened((data) => setGlanceState({ active: true, url: data.url }));
    window.astra.onGlanceClosed(() => setGlanceState({ active: false, url: '' }));

    window.astra.requestTabs();
    window.astra.requestSpaces();
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

  const setMode = (mode: PanelMode) => {
    if (mode === 'bookmarks') window.astra.getBookmarks();
    if (mode === 'history') window.astra.getHistory();
    setPanelMode(mode);
  };

  // Compact mode sidebar classes
  const sidebarClasses = [
    'sidebar',
    compactState.mode !== 'full' ? 'compact-mode' : '',
    compactState.mode !== 'full' && !compactState.sidebarVisible ? 'compact-hidden' : '',
    compactState.mode !== 'full' && compactState.sidebarVisible ? 'compact-visible' : '',
  ].filter(Boolean).join(' ');

  // --------------------------------------------------
  // Memoized derived state
  // --------------------------------------------------

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId), [tabs, activeTabId]);
  const pinnedTabs = useMemo(() => tabs.map((t, i) => ({ ...t, originalIndex: i })).filter(t => t.isPinned), [tabs]);
  const unpinnedTabs = useMemo(() => tabs.map((t, i) => ({ ...t, originalIndex: i })).filter(t => !t.isPinned), [tabs]);
  const activeDownloads = useMemo(() => downloads.filter(d => d.state === 'progressing'), [downloads]);

  return (
    <div className={sidebarClasses} onClick={() => setSpaceContextMenu(null)}>
      {/* Pinned Tabs — Zen's favicon grid */}
      {pinnedTabs.length > 0 && (
        <div className="pinned-tabs">
          {pinnedTabs.map(t => (
            <PinnedTab key={t.id} tab={t} index={t.originalIndex} isActive={t.id === activeTabId} onSwitch={switchTab} onUnpin={unpinTab} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} />
          ))}
        </div>
      )}

      {/* Workspace Indicator — Zen's "🍕 Personal" section header */}
      {spaces.length > 0 && (() => {
        const active = spaces.find(s => s.id === activeSpaceId);
        return active ? (
          <div className="workspace-indicator">
            <span className="workspace-indicator-icon">{active.icon}</span>
            <span className="workspace-indicator-name">{active.name}</span>
          </div>
        ) : null;
      })()}

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

      {/* Tab List */}
      <div className="panel-container">
        {panelMode === 'tabs' && (
          <div className="tab-list">
            {unpinnedTabs.map(t => (
              <TabItem key={t.id} tab={t} index={t.originalIndex} isActive={t.id === activeTabId} onSwitch={switchTab} onPin={pinTab} onClose={closeTab} onDragStart={handleDragStart} onDragOver={handleDragOver} onDrop={handleDrop} />
            ))}
            <div className="tab new-tab-inline" onClick={() => window.astra.newTab()}>
              <span className="tab-favicon">+</span>
              <span className="tab-title">New Tab</span>
            </div>
          </div>
        )}

        {panelMode === 'bookmarks' && (
          <div className="list-panel">
            <h3>Bookmarks</h3>
            {bookmarks.length === 0 ? <p className="empty-msg">No bookmarks.</p> : bookmarks.map(b => (
              <div key={b.id} className="list-item" onClick={() => { window.astra.navigate(b.url); setPanelMode('tabs'); }}>
                <span>⭐</span>
                <div className="list-item-text">
                  <div className="list-item-title">{b.title || b.url}</div>
                  <div className="list-item-url">{b.url}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {panelMode === 'history' && (
          <div className="list-panel">
            <div className="panel-header">
              <h3>History</h3>
              <button className="clear-btn" onClick={() => window.astra.clearHistory()}>Clear</button>
            </div>
            {history.length === 0 ? <p className="empty-msg">History is empty.</p> : history.map(h => (
              <div key={h.id} className="list-item" onClick={() => { window.astra.navigate(h.url); setPanelMode('tabs'); }}>
                <span>🕐</span>
                <div className="list-item-text">
                  <div className="list-item-title">{h.title || h.url}</div>
                  <div className="list-item-url">{h.url}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {panelMode === 'settings' && (
          <div className="list-panel settings">
            <h3>Settings</h3>
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
              <div className="setting-info" style={{ fontSize: '10px', opacity: 0.6 }}>
                Canvas noise · WebGL spoofing · Referrer trimming
              </div>
            </div>
            <div className="setting-group">
              <label>Keyboard Shortcuts</label>
              <div className="setting-info" style={{ fontSize: '10px', lineHeight: '1.6' }}>
                Ctrl+S — Toggle compact mode<br/>
                Ctrl+Shift+S — Split view<br/>
                Ctrl+Shift+C — Copy URL<br/>
                Ctrl+Alt+←/→ — Switch workspace<br/>
                Escape — Close glance/find
              </div>
            </div>
            <div className="setting-group">
              <label>Bangs</label>
              <div className="setting-info" style={{ fontSize: '10px', lineHeight: '1.6' }}>
                !g Google · !yt YouTube · !gh GitHub<br/>
                !w Wikipedia · !so Stack Overflow<br/>
                !mdn MDN · !npm npm · !r Reddit<br/>
                <span style={{ opacity: 0.5 }}>Works anywhere in query: "react !mdn hooks"</span>
              </div>
            </div>
          </div>
        )}
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

      {/* Workspace Strip (moved to bottom) */}
      {spaces.length > 0 && (
        <div className="workspace-strip">
          <div className="workspace-strip-row">
            {spaces.map(space => (
              <div
                key={space.id}
                className={`space-icon ${space.id === activeSpaceId ? 'active' : ''}`}
                style={{ '--space-color': space.color } as React.CSSProperties}
                onClick={() => window.astra.switchSpace(space.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSpaceContextMenu({ x: e.clientX, y: e.clientY, spaceId: space.id });
                }}
                title={space.name}
              >
                {space.icon}
              </div>
            ))}
            <button
              className="space-add-btn"
              onClick={() => window.astra.createSpace({ name: '', color: '', icon: '' })}
              title="New Workspace"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Bottom Bar */}
      <div className="sidebar-footer">
        <button className="bottom-icon" onClick={() => setPanelMode(panelMode === 'settings' ? 'tabs' : 'settings')} title="Settings">⚙</button>
        <div className="bottom-space-dots">
          {spaces.map(space => (
            <div
              key={space.id}
              className={`bottom-space-dot ${space.id === activeSpaceId ? 'active' : ''}`}
              style={{ background: space.color || '#888' }}
              onClick={() => window.astra.switchSpace(space.id)}
              title={space.name}
            />
          ))}
        </div>
        <button className="bottom-icon" onClick={() => setPanelMode(panelMode === 'bookmarks' ? 'tabs' : 'bookmarks')} title="Bookmarks">⭐</button>
        <button className="bottom-icon" onClick={() => setPanelMode(panelMode === 'history' ? 'tabs' : 'history')} title="History">🕐</button>
        {activeDownloads.length > 0 && (
          <button className="bottom-icon" title="Downloads">📥</button>
        )}
      </div>

      {/* Space Context Menu */}
      {spaceContextMenu && (
        <div
          className="space-context-menu"
          style={{ top: spaceContextMenu.y, left: spaceContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="space-context-item" onClick={() => {
            const name = prompt('Rename workspace:', spaces.find(s => s.id === spaceContextMenu.spaceId)?.name);
            if (name) window.astra.renameSpace(spaceContextMenu.spaceId, name);
            setSpaceContextMenu(null);
          }}>✏️ Rename</button>
          <button className="space-context-item" onClick={() => {
            const color = prompt('Enter color (hex):', spaces.find(s => s.id === spaceContextMenu.spaceId)?.color);
            if (color) window.astra.updateSpaceColor(spaceContextMenu.spaceId, color);
            setSpaceContextMenu(null);
          }}>🎨 Change Color</button>
          {spaces.length > 1 && (
            <button className="space-context-item danger" onClick={() => {
              if (confirm('Delete this workspace? Tabs will move to another workspace.')) {
                window.astra.deleteSpace(spaceContextMenu.spaceId);
              }
              setSpaceContextMenu(null);
            }}>🗑️ Delete</button>
          )}
        </div>
      )}

      {/* Toasts & Overlays */}
      {urlCopiedToast && <div className="url-copied-toast">✓ URL copied to clipboard</div>}

      {compactState.mode !== 'full' && (
        <div className="compact-indicator" onClick={() => window.astra.toggleCompactMode()} title="Click to change mode">
          📐 {compactState.mode === 'compact' ? 'Compact' : 'Zen'}
        </div>
      )}

      {glanceState.active && (
        <div className="glance-overlay-bar">
          <span className="glance-url">{glanceState.url}</span>
          <button className="glance-expand" onClick={() => window.astra.expandGlance()}>⬆ Open as Tab</button>
          <button onClick={() => window.astra.closeGlance()}>✕ Close</button>
        </div>
      )}
    </div>
  );
};

export default App;
