// Night is a stopgap dark theme, deliberately kept separate from
// src/lib/theme.ts's sand/moss switcher: THEME_IDS (@roman-mik/kapa-core/theme)
// has no 'night' id yet, and useTheme()'s setTheme() persists to
// core.profiles.theme, which is typed (and possibly DB-constrained) to the
// real ThemeId union. Night stays local-only — its own storage key, applied
// via a separate `data-night` attribute (not `data-theme`) so it composes
// with whichever of sand/moss is active rather than overwriting it. Retire
// this file once kapa-core ships a real Night definition and THEME_IDS
// includes it for real.
const STORAGE_KEY = 'kapa-night-mode';

export function readNightMode(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'true';
}

export function storeNightMode(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(enabled));
}

export function applyNightMode(enabled: boolean): void {
  if (enabled) {
    document.documentElement.setAttribute('data-night', 'true');
  } else {
    document.documentElement.removeAttribute('data-night');
  }
}
