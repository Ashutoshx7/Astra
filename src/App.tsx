import React, { useState, useEffect } from 'react';

// Type declaration for the preload bridge
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
      onTabUpdate: (callback: (data: any) => void) => void;
      onUrlChanged: (callback: (url: string) => void) => void;
    };
  }
}

interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
}

const App: React.FC = () => {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: 'DuckDuckGo', url: 'https://duckduckgo.com', favicon: '🦆' },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [urlInput, setUrlInput] = useState('https://duckduckgo.com');

  // Listen for updates from the main process
  useEffect(() => {
    window.astra.onTabUpdate((data) => {
      setTabs(prev => prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, title: data.title, url: data.url }
          : tab
      ));
    });

    window.astra.onUrlChanged((url) => {
      setUrlInput(url);
    });
  }, [activeTabId]);

  // Navigate when user submits URL
  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    window.astra.navigate(urlInput);
  };

  const handleNewTab = () => {
    const newTab: Tab = {
      id: Date.now().toString(),
      title: 'New Tab',
      url: 'about:blank',
      favicon: '🌐',
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
    setUrlInput('');
  };

  const handleCloseTab = (tabId: string) => {
    const filtered = tabs.filter(t => t.id !== tabId);
    if (filtered.length === 0) {
      handleNewTab();
      return;
    }
    setTabs(filtered);
    if (activeTabId === tabId) {
      setActiveTabId(filtered[filtered.length - 1].id);
    }
  };

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
          <input
            className="url-input"
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Search or enter URL..."
            spellCheck={false}
          />
        </form>
      </div>

      {/* Tab List */}
      <div className="tab-list">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => {
              setActiveTabId(tab.id);
              setUrlInput(tab.url);
            }}
          >
            <span className="tab-favicon">{tab.favicon}</span>
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                handleCloseTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <button className="btn-new-tab" onClick={handleNewTab}>
          + New Tab
        </button>
      </div>
    </div>
  );
};

export default App;
