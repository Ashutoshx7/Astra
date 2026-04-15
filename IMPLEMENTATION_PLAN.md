# Astra Browser — Implementation Plan

> Every line of code in this document has a purpose. No bloat. No noise.

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     BaseWindow (Electron)                     │
│                                                              │
│  ┌─────────────┐  ┌──────────────────────────────────────┐  │
│  │             │  │                                      │  │
│  │  SIDEBAR    │  │           WEB VIEW                   │  │
│  │  (React)    │  │      (WebContentsView)                │  │
│  │             │  │                                      │  │
│  │  - URL Bar  │  │   Renders actual websites            │  │
│  │  - Tabs     │  │   One view per tab                   │  │
│  │  - Spaces   │  │   Hidden/shown on tab switch         │  │
│  │  - Search   │  │                                      │  │
│  │             │  │                                      │  │
│  │  280px      │  │   Rest of window                     │  │
│  │             │  │                                      │  │
│  └─────────────┘  └──────────────────────────────────────┘  │
│                                                              │
│  IPC Bridge (preload.ts) ←──→ Main Process (main.ts)        │
│  Ghostery Ad Blocker ←──→ All WebContentsViews              │
│  SQLite (better-sqlite3) ←──→ History, Bookmarks, Settings  │
└──────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Window Shell | Electron (BaseWindow) | Lightweight container, no web content overhead |
| Web Rendering | WebContentsView (Chromium) | One per tab, native Chromium rendering |
| Sidebar UI | React + TypeScript | Component-based, type-safe, fast iteration |
| Styling | Vanilla CSS | No framework churn, full control |
| Bundler | Vite | Instant HMR, fast builds |
| Ad Blocker | @ghostery/adblocker-electron | Battle-tested, 300K+ filter rules, low overhead |
| Database | better-sqlite3 | Synchronous, fast, zero-config, local-only |
| Packaging | Electron Forge | Build for Linux, macOS, Windows |

## File Structure (Target)

```
src/
├── main.ts                 # Electron main process entry
├── preload.ts              # IPC bridge (contextBridge)
├── renderer.tsx            # React entry point
├── App.tsx                 # Root React component
│
├── components/
│   ├── Sidebar.tsx         # Sidebar container
│   ├── URLBar.tsx          # URL input + nav buttons
│   ├── TabList.tsx         # Tab list with drag-and-drop
│   ├── TabItem.tsx         # Individual tab component
│   ├── SpacePicker.tsx     # Space/workspace selector
│   ├── CommandPalette.tsx  # Cmd+K command palette
│   └── NewTabPage.tsx      # New tab page with search
│
├── managers/
│   ├── TabManager.ts       # Multi-tab WebContentsView lifecycle
│   ├── AdBlocker.ts        # Ghostery integration
│   ├── SpaceManager.ts     # Workspace/space logic
│   └── SettingsManager.ts  # User preferences
│
├── database/
│   ├── db.ts               # SQLite connection + migrations
│   ├── history.ts          # Browsing history queries
│   ├── bookmarks.ts        # Bookmark CRUD
│   └── settings.ts         # Settings persistence
│
├── utils/
│   ├── urlParser.ts        # URL validation + search detection
│   └── favicon.ts          # Favicon fetching + caching
│
├── styles/
│   ├── index.css           # Global styles + CSS variables
│   ├── sidebar.css         # Sidebar-specific styles
│   └── animations.css      # Micro-animations
│
└── types/
    └── index.ts            # Shared TypeScript interfaces
```

---

## Module Breakdown

### 1. Tab Manager (`src/managers/TabManager.ts`)

The most critical module. Manages the lifecycle of multiple WebContentsViews.

**Responsibilities:**
- Create new WebContentsView for each tab
- Show/hide views when switching tabs
- Track tab state (URL, title, favicon, loading status)
- Tab hibernation: unload inactive tabs after 10 minutes to save RAM
- Send tab events to sidebar via IPC

**Key Data Structure:**
```typescript
interface ManagedTab {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
  isHibernated: boolean;
  lastActiveAt: number;
  spaceId: string;
}
```

### 2. Ad Blocker (`src/managers/AdBlocker.ts`)

Integrates Ghostery's ad blocker engine into every WebContentsView.

**Responsibilities:**
- Initialize blocker with filter lists on app start
- Attach to every new WebContentsView
- Block network requests matching ad/tracker patterns
- Count blocked requests per tab
- Update filter lists periodically (weekly)

### 3. Space Manager (`src/managers/SpaceManager.ts`)

Workspaces — group tabs by context (Work, Personal, Research).

**Responsibilities:**
- CRUD operations for spaces
- Assign tabs to spaces
- Switch active space (hides/shows tabs)
- Persist spaces to SQLite
- Default spaces: Personal, Work

### 4. Database (`src/database/db.ts`)

Local SQLite database for all persistent data.

**Tables:**
```sql
-- Browsing history
CREATE TABLE history (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  visit_count INTEGER DEFAULT 1,
  last_visited_at INTEGER NOT NULL
);

-- Bookmarks
CREATE TABLE bookmarks (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  folder TEXT DEFAULT 'unsorted',
  created_at INTEGER NOT NULL
);

-- Spaces
CREATE TABLE spaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT,
  position INTEGER NOT NULL
);

-- Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Tab state (for session restore)
CREATE TABLE saved_tabs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  space_id TEXT,
  position INTEGER NOT NULL
);
```

### 5. Command Palette (`src/components/CommandPalette.tsx`)

Arc-inspired Cmd+K palette for power users.

**Features:**
- Search open tabs
- Search browsing history
- Search bookmarks
- Quick actions (new tab, close tab, switch space)
- Fuzzy matching

### 6. URL Parser (`src/utils/urlParser.ts`)

Smart URL handling:
- Detect if input is URL or search query
- Auto-prepend `https://`
- Support `!bang` shortcuts (e.g., `!g cats` → Google search)
- Support search engine switching

---

## IPC Message Protocol

### Sidebar → Main Process

| Channel | Payload | Description |
|---------|---------|-------------|
| `navigate` | `{ url: string }` | Navigate active tab to URL |
| `go-back` | — | Go back in active tab |
| `go-forward` | — | Go forward in active tab |
| `refresh` | — | Reload active tab |
| `new-tab` | `{ url?: string, spaceId?: string }` | Create new tab |
| `close-tab` | `{ tabId: string }` | Close specific tab |
| `switch-tab` | `{ tabId: string }` | Switch to specific tab |
| `switch-space` | `{ spaceId: string }` | Switch active space |
| `update-settings` | `{ key, value }` | Update a setting |

### Main Process → Sidebar

| Channel | Payload | Description |
|---------|---------|-------------|
| `tab-updated` | `{ id, title, url, favicon, isLoading }` | Tab state changed |
| `tab-created` | `{ id, title, url, spaceId }` | New tab created |
| `tab-closed` | `{ tabId }` | Tab was closed |
| `url-changed` | `{ url }` | Active tab URL changed |
| `tabs-list` | `Tab[]` | Full tab list (on startup/sync) |
| `blocked-count` | `{ tabId, count }` | Ad blocker stats |

---

## Privacy & Security

### Built-in Protections (Day 1)
- [x] `contextIsolation: true` — sidebar can't access web page globals
- [x] `sandbox: true` — renderer can't access OS
- [x] `nodeIntegration: false` — no `require()` in browser
- [ ] HTTPS-only mode (upgrade insecure requests)
- [ ] Third-party cookie blocking
- [ ] Tracker blocking via Ghostery
- [ ] No telemetry — zero outbound connections except user navigation
- [ ] Clear browsing data on exit (optional)

### Future Protections
- [ ] Fingerprint resistance (canvas, WebGL, audio)
- [ ] Referrer trimming
- [ ] DNS-over-HTTPS
- [ ] Per-site permissions (camera, mic, location)

---

## Performance Strategy

### Tab Hibernation
Tabs inactive for >10 minutes get "hibernated":
1. Save current URL
2. Replace WebContentsView content with `about:blank`
3. Free the renderer process memory
4. On re-activation: reload from saved URL

**Expected savings:** ~50-150MB RAM per hibernated tab

### Lazy Loading
- Sidebar components loaded on-demand
- Command palette only initialized when opened
- Settings panel loaded on first access

### Startup Optimization
- Zero network requests on startup (no telemetry, no update checks, no sync)
- Pre-built ad blocker filter cache (no first-run download delay)
- Session restore: load tab URLs but don't render until clicked

---

## Extension Support (Post v1.0)

### Phase 1: Basic Extension Loading
```typescript
// Load unpacked extensions from filesystem
session.defaultSession.loadExtension('/path/to/extension');
```
- Support for content scripts
- Support for basic popup extensions
- Manual install from downloaded `.crx` files

### Phase 2: electron-chrome-extensions
- Install `electron-chrome-extensions` package
- Map tab/window APIs to Astra's tab manager
- Support ~60% of Chrome extensions
- Focus: Dark Reader, Bitwarden, simple tools

### Phase 3: (If growth supports it)
- Consider Chromium fork for 100% compatibility
- Only with community contributors + funding

---

## Build & Distribution

### Targets
| Platform | Package Format | Tool |
|----------|---------------|------|
| Linux | `.deb`, `.rpm`, `.AppImage` | electron-forge makers |
| macOS | `.dmg`, `.zip` | electron-forge + notarization |
| Windows | `.exe` (Squirrel) | electron-forge maker-squirrel |

### CI/CD
- GitHub Actions for automated builds on tag push
- Auto-generate release notes from commits
- Upload artifacts to GitHub Releases

### Auto-Updates
- Electron's built-in `autoUpdater` via GitHub Releases
- Check for updates every 24 hours (user-controllable)
- Download in background, prompt to restart
