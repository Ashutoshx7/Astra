import { CONFIG } from '../types';

/**
 * Bang shortcuts — Helium's most popular productivity feature.
 *
 * Helium patches Chromium's AutocompleteInput to detect bang patterns
 * anywhere in the query (not just prefix like DuckDuckGo).
 *
 * Example: "react hooks !mdn" → searches MDN for "react hooks"
 *          "!g electron api" → searches Google for "electron api"
 *          "cats !yt funny" → searches YouTube for "cats funny"
 */
const BANGS: Record<string, string> = {
  '!g':    'https://www.google.com/search?q=',
  '!d':    'https://duckduckgo.com/?q=',
  '!b':    'https://www.bing.com/search?q=',
  '!w':    'https://en.wikipedia.org/wiki/Special:Search?search=',
  '!yt':   'https://www.youtube.com/results?search_query=',
  '!gh':   'https://github.com/search?q=',
  '!so':   'https://stackoverflow.com/search?q=',
  '!r':    'https://www.reddit.com/search/?q=',
  '!npm':  'https://www.npmjs.com/search?q=',
  '!mdn':  'https://developer.mozilla.org/en-US/search?q=',
  '!tw':   'https://twitter.com/search?q=',
  '!am':   'https://www.amazon.com/s?k=',
  '!maps': 'https://www.google.com/maps/search/',
  '!img':  'https://www.google.com/search?tbm=isch&q=',
  '!t':    'https://translate.google.com/?sl=auto&tl=en&text=',
};

/**
 * Try to extract a bang from anywhere in the input.
 * Returns { bang, query } if found, null otherwise.
 *
 * Helium's innovation: bangs work ANYWHERE in the query, not just at the start.
 * "react hooks !mdn" → bang="!mdn", query="react hooks"
 */
function extractBang(input: string): { bang: string; query: string } | null {
  const words = input.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const lower = words[i].toLowerCase();
    if (BANGS[lower]) {
      const queryWords = [...words.slice(0, i), ...words.slice(i + 1)];
      return { bang: lower, query: queryWords.join(' ') };
    }
  }
  return null;
}

/**
 * Parses user input and returns a navigable URL.
 *
 * Rules (in priority order):
 *   1. Bang shortcuts (!g, !yt, etc.) — anywhere in input (Helium pattern)
 *   2. If input contains spaces or no dot → treat as search query
 *   3. If input has no protocol → prepend https://
 *   4. Otherwise → use as-is
 */
export function parseUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return CONFIG.DEFAULT_URL;
  }

  // 1. Check for bang shortcut (Helium-style, anywhere in query)
  const bangResult = extractBang(trimmed);
  if (bangResult) {
    const searchUrl = BANGS[bangResult.bang];
    return `${searchUrl}${encodeURIComponent(bangResult.query)}`;
  }

  // 2. Has spaces or no dot = search query
  if (trimmed.includes(' ') || !trimmed.includes('.')) {
    return `${CONFIG.SEARCH_URL}${encodeURIComponent(trimmed)}`;
  }

  // 3. Missing protocol = add https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }

  return trimmed;
}
