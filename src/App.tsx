import React, { useState, useEffect } from 'react';

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
      onTabsUpdated: (callback: (data: any) => void) => void;
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
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [urlInput, setUrlInput] = useState('');

  // Listen for tab updates from main process
  useEffect(() => {
    window.astra.onTabsUpdated((data) => {
      setTabs(data.tabs);
      setActiveTabId(data.activeTabId);
    });

    window.astra.onUrlChanged((url) => {
      setUrlInput(url);
    });

    // Ask main process for current tabs (they were created before React mounted)
    window.astra.requestTabs();
  }, []);

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    window.astra.navigate(urlInput);
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
            onClick={() => window.astra.switchTab(tab.id)}
          >
            <span className="tab-favicon">{tab.favicon}</span>
            <span className="tab-title">{tab.title}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                window.astra.closeTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

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
