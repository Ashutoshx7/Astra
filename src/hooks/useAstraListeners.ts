import { useEffect, useRef } from 'react';
import type {
  Tab,
  SpaceData,
  UrlSuggestion,
  Bookmark,
  HistoryEntry,
  DownloadItem,
  FindResult,
  CompactState,
} from '../types/renderer';

interface Setters {
  setTabs: (tabs: Tab[]) => void;
  setActiveTabId: (id: string) => void;
  setUrlInput: (url: string) => void;
  setIsBookmarked: (v: boolean) => void;
  setSuggestions: (s: UrlSuggestion[]) => void;
  setShowSuggestions: (v: boolean) => void;
  setBookmarks: (b: Bookmark[]) => void;
  setHistory: (h: HistoryEntry[]) => void;
  setZoomLevel: (z: number) => void;
  setShowFindBar: (v: boolean) => void;
  setFindResult: (r: FindResult | null) => void;
  setDownloads: React.Dispatch<React.SetStateAction<DownloadItem[]>>;
  setSpaces: (s: SpaceData[]) => void;
  setActiveSpaceId: (id: string) => void;
  setUrlCopiedToast: (v: boolean) => void;
  setCompactState: (s: CompactState) => void;
  setGlanceActive: (active: boolean, url?: string) => void;
  urlInputRef: React.RefObject<HTMLInputElement | null>;
  findInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * Registers all window.astra IPC listeners and performs initial data requests.
 * Centrally manages all event subscriptions so App.tsx stays clean.
 */
export function useAstraListeners(setters: Setters) {
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const {
      setTabs, setActiveTabId, setUrlInput, setIsBookmarked,
      setSuggestions, setShowSuggestions, setBookmarks, setHistory,
      setZoomLevel, setShowFindBar, setFindResult, setDownloads,
      setSpaces, setActiveSpaceId, setUrlCopiedToast,
      setCompactState, setGlanceActive,
      urlInputRef, findInputRef,
    } = setters;

    window.astra.onTabsUpdated((data) => {
      setTabs(data.tabs);
      setActiveTabId(data.activeTabId || '');
    });

    window.astra.onUrlChanged((url) => setUrlInput(url));

    window.astra.onFocusUrlBar(() => {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    });

    window.astra.onSuggestions((r) => {
      setSuggestions(r);
      setShowSuggestions(r.length > 0);
    });

    window.astra.onBookmarkStatus((s) => setIsBookmarked(s));
    window.astra.onBookmarksResult((r) => setBookmarks(r));
    window.astra.onHistoryResult((r) => setHistory(r));
    window.astra.onZoomChanged((z) => setZoomLevel(z));

    window.astra.onShowFindBar(() => {
      setShowFindBar(true);
      setTimeout(() => findInputRef.current?.focus(), 50);
    });

    window.astra.onFindResult((r) => {
      if (r === null) {
        setShowFindBar(false);
        setFindResult(null);
      } else {
        setFindResult(r);
      }
    });

    window.astra.onDownloadUpdated((dl) => {
      setDownloads((prev) => {
        const i = prev.findIndex((d) => d.id === dl.id);
        if (i >= 0) {
          const updated = [...prev];
          updated[i] = dl;
          return updated;
        }
        return [...prev, dl];
      });
    });

    window.astra.onSpacesUpdated((data) => {
      setSpaces(data.spaces);
      setActiveSpaceId(data.activeSpaceId);
    });

    window.astra.onUrlCopied(() => {
      setUrlCopiedToast(true);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setUrlCopiedToast(false), 1800);
    });

    window.astra.onCompactState((state) => setCompactState(state));

    window.astra.onGlanceOpened((data) => setGlanceActive(true, data.url));
    window.astra.onGlanceClosed(() => setGlanceActive(false));

    window.astra.onSidebarWidthChanged((width) => {
      document.documentElement.style.setProperty('--astra-sidebar-width', `${width}px`);
    });

    // Initial data requests
    window.astra.requestTabs();
    window.astra.requestSpaces();

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
