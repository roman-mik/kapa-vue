import { THEME_IDS, type ThemeId } from '@roman-mik/kapa-core/theme';

const STORAGE_KEY = 'kapa-theme';
export const DEFAULT_THEME: ThemeId = 'sand';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

export function readStoredTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  return isThemeId(stored) ? stored : DEFAULT_THEME;
}

export function storeTheme(id: ThemeId): void {
  localStorage.setItem(STORAGE_KEY, id);
}

// Matches the attribute index.html's pre-paint inline script already sets,
// so this is idempotent when called again once Vue mounts.
export function applyTheme(id: ThemeId): void {
  document.documentElement.setAttribute('data-theme', id);
  syncThemeColor();
}

// Keep the browser/status-bar chrome in step with the active theme instead of
// a hardcoded value. Reads the theme's --kapa-accent from the CSS variables
// that main.css's [data-theme] block just selected. No-op in environments
// without a theme-color meta or computed styles (e.g. tests).
function syncThemeColor(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const accent = getComputedStyle(document.documentElement)
    .getPropertyValue('--kapa-accent')
    .trim();
  if (accent) meta.setAttribute('content', accent);
}
