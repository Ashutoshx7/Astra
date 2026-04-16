import { CONFIG } from '../types';

/**
 * Parses user input and returns a navigable URL.
 *
 * Rules:
 *   - If input contains spaces or no dot → treat as search query
 *   - If input has no protocol → prepend https://
 *   - Otherwise → use as-is
 */
export function parseUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return CONFIG.DEFAULT_URL;
  }

  // Has spaces or no dot = search query
  if (trimmed.includes(' ') || !trimmed.includes('.')) {
    return `${CONFIG.SEARCH_URL}${encodeURIComponent(trimmed)}`;
  }

  // Missing protocol = add https
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }

  return trimmed;
}
