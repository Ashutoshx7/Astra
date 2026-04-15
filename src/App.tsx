import React, { useState } from 'react';

// Tab type
interface Tab {
  id: string;
  title: string;
  url: string;
  favicon: string;
}

const App: React.FC = () => {
  // State: list of tabs and which one is active
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', title: 'DuckDuckGo', url: 'https://duckduckgo.com', favicon: '🦆' },
  ]);
  const [activeTabId, setActiveTabId] = useState('1');
  const [urlInput, setUrlInput] = useState('https://duckduckgo.com');

  // Handle URL submission
  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Tell main process to navigate the webView
    console.log('Navigate to:', urlInput);
  };

  // Add a new tab
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

  // Close a tab
  const handleCloseTab = (tabId: string) => {
    const filtered = tabs.filter(t => t.id !== tabId);
    if (filtered.length === 0) {
      // Don't close last tab, open a new one instead
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
          <button className="nav-btn" title="Back">←</button>
          <button className="nav-btn" title="Forward">→</button>
          <button className="nav-btn" title="Refresh">↻</button>
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
