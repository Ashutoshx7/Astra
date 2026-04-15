# Astra Browser — Roadmap

> From zero to shipping. Solo dev. No excuses.

---

## Current Progress

```
██████░░░░░░░░░░░░░░░░░░░░░░░░  15% — Foundation Complete
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
- [ ] **Day 3: Multi-tab support**
  - Create new WebContentsView per tab
  - Show/hide views on tab switch
  - Track tab state (URL, title, favicon)
  - "+ New Tab" creates real tabs
- [ ] **Day 4: Tab polish**
  - Loading spinner per tab
  - Favicon fetching
  - Tab close button
  - Ctrl+T / Ctrl+W / Ctrl+Tab shortcuts
- [ ] **Day 5: New Tab page**
  - Search box (DuckDuckGo by default)
  - Recently visited sites
  - Clean, minimal design

### Week 2: Real Browser Features
- [ ] **Day 1: Smart URL bar**
  - Auto-detect URL vs search query
  - Search suggestions from history
  - `!bang` shortcuts (!g, !yt, !w)
  - URL autocomplete from history
- [ ] **Day 2: Browsing history**
  - SQLite database setup
  - Record every visit
  - History search in command palette
  - Clear history option
- [ ] **Day 3: Bookmarks**
  - Bookmark current page (Ctrl+D)
  - Bookmark sidebar section
  - Folder organization
  - Import from Chrome/Firefox (JSON)
- [ ] **Day 4: Context menus**
  - Right-click on page (open link in new tab, copy, etc.)
  - Right-click on tab (duplicate, pin, close others)
  - Right-click on sidebar (settings, about)
- [ ] **Day 5: Window management**
  - Remember window size/position
  - Session restore (reopen tabs on restart)
  - Multiple windows support

### Week 3: Polish + Security
- [ ] **Day 1: Downloads**
  - Download progress bar
  - Download complete notification
  - Open downloads folder
- [ ] **Day 2: Find in page**
  - Ctrl+F → search bar overlay
  - Highlight matches
  - Next/previous match
- [ ] **Day 3: Permissions**
  - Camera/mic/location permission prompts
  - Per-site permission memory
  - Notification permissions
- [ ] **Day 4: HTTPS + Security**
  - HTTPS-only mode
  - Certificate error handling
  - Mixed content blocking
  - Security indicator in URL bar (🔒)
- [ ] **Day 5: Testing + bug fixes**
  - Test on 20+ popular websites
  - Fix rendering issues
  - Performance profiling
  - Memory leak hunting

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
- [ ] Sidebar collapse/expand animation
- [ ] Tab drag-to-reorder
- [ ] Tab preview on hover (thumbnail)
- [ ] Smooth page transitions
- [ ] Loading progress bar (top of web view)
- [ ] Custom scrollbar styling
- [ ] Dark/light theme toggle
- [ ] Custom accent colors

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
