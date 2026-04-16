# Astra Browser — Roadmap

> From zero to shipping. Solo dev. No excuses.

---

## Current Progress

```
████████████████████░░░░░░░░░░  65% — Beta Ready
```

### ✅ Done
- [x] Project scaffolding (Electron + Vite + React + TypeScript)
- [x] BaseWindow + WebContentsView architecture
- [x] Dark sidebar UI with URL bar
- [x] IPC bridge (preload → main process)
- [x] Navigation: URL input → page loads
- [x] Back / Forward / Refresh buttons
- [x] Tab title + URL auto-update from page
- [x] GitHub repo (private)

---

## Phase 1: The Browser (Weeks 1-3)

> Goal: A functional multi-tab browser you can actually use for daily browsing.

### Week 1: Shell + Basic Navigation ← YOU ARE HERE
- [x] ~~Day 1: Project setup, BaseWindow, WebContentsView~~
- [x] ~~Day 2: Sidebar UI, URL bar, IPC bridge~~
- [x] **Day 3: Multi-tab support**
  - [x] Create new WebContentsView per tab
  - [x] Show/hide views on tab switch
  - [x] Track tab state (URL, title, favicon)
  - [x] "+ New Tab" creates real tabs
- [x] **Day 4: Tab polish**
  - [x] Loading spinner per tab
  - [x] Favicon fetching
  - [x] Tab close button
  - [x] Ctrl+T / Ctrl+W / Ctrl+Tab shortcuts (Implemented in main process)
- [x] **Day 5: New Tab page**
  - [x] Search box (DuckDuckGo by default)
  - [x] Recently visited sites
  - [x] Clean, minimal design (Zenith Spec)

### Week 2: Real Browser Features
- [x] **Day 1: Smart URL bar**
  - [x] Auto-detect URL vs search query
  - [x] Search suggestions from history
  - [x] `!bang` shortcuts (!g, !yt, !w)
  - [x] URL autocomplete from history
- [x] **Day 2: Browsing history**
  - [x] SQLite database setup
  - [x] Record every visit
  - [x] History search in command palette (Integrated in Sidebar)
  - [x] Clear history option
- [x] **Day 3: Bookmarks**
  - [x] Bookmark current page (Ctrl+D)
  - [x] Bookmark sidebar section
  - [x] Folder organization (Foundations)
  - [ ] Import from Chrome/Firefox (JSON)
- [x] **Day 4: Context menus**
  - [x] Right-click on page (open link in new tab, copy, etc.)
  - [x] Right-click on tab (duplicate, pin, close others)
  - [x] Right-click on sidebar (settings, about)
- [x] **Day 5: Window management**
  - [x] Remember window size/position
  - [x] Session restore (reopen tabs on restart)
  - [x] Multiple windows support (Architecture ready)

### Week 3: Polish + Security
- [x] **Day 1: Downloads**
  - [x] Download progress bar
  - [x] Download complete notification
  - [x] Open downloads folder
- [x] **Day 2: Find in page**
  - [x] Ctrl+F → search bar overlay
  - [x] Highlight matches
  - [x] Next/previous match
- [x] **Day 3: Permissions**
  - [x] Camera/mic/location permission prompts
  - [x] Per-site permission memory
  - [ ] Notification permissions
- [x] **Day 4: HTTPS + Security**
  - [x] HTTPS-only mode
  - [x] Certificate error handling
  - [x] Mixed content blocking
  - [x] Security indicator in URL bar (🔒)
- [x] **Day 5: Testing + bug fixes**
  - [x] Test on 20+ popular websites
  - [x] Fix rendering issues
  - [x] Performance profiling (Audit Complete)
  - [x] Memory leak hunting

---

## Phase 2: The Soul (Weeks 4-6)

> Goal: What makes Astra different from every other browser.

### Week 4: Ad Blocker + Privacy
- [ ] **Day 1: Ghostery integration**
  - Initialize ad blocker engine on app start
  - Attach to every WebContentsView
  - Block requests matching filter rules
- [ ] **Day 2: Block counter + privacy dashboard**
  - Show blocked count per tab (badge on tab)
  - Show blocked count in sidebar
  - Privacy dashboard page (total blocks, top trackers)
- [ ] **Day 3: Third-party cookie blocking**
  - Block all third-party cookies by default
  - Whitelist for sites that break
  - Cookie management UI
- [ ] **Day 4: Tracker protection**
  - Block known tracking scripts
  - Block tracking pixels
  - Referrer trimming
- [ ] **Day 5: Privacy settings page**
  - Toggle per-feature (ad blocking, cookie blocking, etc.)
  - Clear data on exit option
  - Per-site overrides

### Week 5: Spaces (Workspaces)
- [ ] **Day 1: Space data model**
  - Create/edit/delete spaces
  - Assign tabs to spaces
  - SQLite persistence
- [ ] **Day 2: Space UI in sidebar**
  - Space selector at top of sidebar
  - Color-coded spaces
  - Space icons
- [ ] **Day 3: Space switching**
  - Switch spaces → hide/show relevant tabs
  - Each space has its own tab list
  - Smooth transition animation
- [ ] **Day 4: Default spaces + onboarding**
  - Pre-create "Personal" and "Work" spaces
  - First-run onboarding flow
  - Space customization
- [ ] **Day 5: Tab pinning**
  - Pin tabs to top of space
  - Pinned tabs persist across restarts
  - Pinned tabs show favicon only (compact)

### Week 6: Command Palette + Power User Features
- [ ] **Day 1: Command palette (Ctrl+K)**
  - Overlay search box
  - Search open tabs
  - Search history
  - Search bookmarks
- [ ] **Day 2: Quick actions**
  - "Close all tabs"
  - "Switch to space: Work"
  - "Toggle ad blocker"
  - "Clear history"
- [ ] **Day 3: Keyboard shortcuts system**
  - Full shortcut map
  - Customizable shortcuts
  - Shortcut hints in command palette
- [ ] **Day 4: Tab hibernation**
  - Auto-hibernate tabs after 10 min inactive
  - Visual indicator for hibernated tabs
  - Manual hibernate/wake option
  - RAM savings counter
- [ ] **Day 5: Split view**
  - Side-by-side two pages
  - Drag tab to split
  - Resize split ratio

---

## Phase 3: Polish + Performance (Weeks 7-9)

> Goal: Make it feel premium. Make it fast.

### Week 7: UI/UX Polish
- [x] Sidebar collapse/expand animation (Zenith Spec)
- [x] Tab drag-to-reorder (HTML5 Native)
- [ ] Tab preview on hover (thumbnail)
- [x] Smooth page transitions
- [x] Loading progress bar (top of web view)
- [x] Custom scrollbar styling
- [x] Dark/light theme toggle (Indigo default)
- [x] Custom accent colors (Indigo/Spring)

### Week 8: Performance
- [ ] Startup time optimization (<1s cold start)
- [ ] Memory profiling + optimization
- [ ] Tab hibernation tuning
- [ ] Lazy load sidebar components
- [ ] Pre-build ad blocker cache
- [ ] Reduce Electron bundle size
- [ ] GPU acceleration audit

### Week 9: Developer Experience
- [ ] DevTools shortcut (F12)
- [ ] View page source
- [ ] Inspect element
- [ ] JavaScript console
- [ ] Network monitor integration
- [ ] Performance panel

---

## Phase 4: Ship It (Weeks 10-12)

> Goal: Package, test, and release Astra to real users.

### Week 10: Cross-Platform Packaging
- [ ] Linux builds (.deb, .rpm, .AppImage)
- [ ] Windows builds (.exe installer)
- [ ] macOS builds (.dmg) — if you have access
- [ ] Auto-update system (GitHub Releases)
- [ ] App icons and branding
- [ ] Installer customization

### Week 11: Testing + Beta
- [ ] Test on Ubuntu, Fedora, Windows 10/11
- [ ] Test with 50+ popular websites
- [ ] Fix platform-specific bugs
- [ ] Memory stress test (100 tabs)
- [ ] Crash recovery testing
- [ ] Beta release to 5-10 friends

### Week 12: Launch
- [ ] Make GitHub repo public
- [ ] Write launch announcement
- [ ] Create landing page (helium.computer style)
- [ ] Post on Reddit (r/linux, r/privacy, r/browsers)
- [ ] Post on Hacker News
- [ ] Post on Product Hunt
- [ ] Set up GitHub Sponsors
- [ ] Create issue templates
- [ ] Write contribution guide

---

## Post-Launch Maintenance

### Monthly (~15-20 hours)
- Electron version bumps (monthly)
- Ad blocker filter list updates (weekly, automated)
- Community bug fixes
- Security patches

### Quarterly
- One new feature per quarter
- Performance audit
- Dependency updates
- Community feedback review

---

## Future Features (v1.0+)

| Feature | Priority | Effort |
|---------|----------|--------|
| Chrome extension support (basic) | High | 2-3 weeks |
| Sync across devices (encrypted) | Medium | 4 weeks |
| Reading mode | Medium | 1 week |
| Screenshot tool | Low | 3 days |
| PDF viewer customization | Low | 1 week |
| Custom CSS per site | Medium | 3 days |
| Vertical tabs grouping | Medium | 1 week |
| Picture-in-Picture | Low | 3 days |
| Built-in password manager | High | 3-4 weeks |
| Fingerprint resistance | Medium | 2 weeks |

---

## Revenue Model (When Ready)

1. **GitHub Sponsors** — Day 1
2. **Search engine partnership** — After 10K users (DuckDuckGo, Brave Search)
3. **Premium features** — Optional paid tier (sync, advanced privacy)
4. **Never:** Ads, data selling, crypto, AI features nobody asked for

---

*Built with blood, sweat, and too much coffee by [@ashutoshx7](https://github.com/ashutoshx7)*
*Last updated: April 16, 2026*
