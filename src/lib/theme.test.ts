import { beforeEach, describe, expect, it } from 'vite-plus/test';
import { DEFAULT_THEME, isThemeId, readStoredTheme, storeTheme } from './theme';

describe('isThemeId', () => {
  it('accepts known theme ids', () => {
    expect(isThemeId('sand')).toBe(true);
    expect(isThemeId('moss')).toBe(true);
  });

  it('rejects unknown values and non-strings', () => {
    expect(isThemeId('midnight')).toBe(false);
    expect(isThemeId(null)).toBe(false);
    expect(isThemeId(42)).toBe(false);
  });
});

describe('readStoredTheme / storeTheme', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to the default when nothing is stored', () => {
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('falls back to the default when the stored value is invalid', () => {
    localStorage.setItem('kapa-theme', 'not-a-theme');
    expect(readStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('round-trips a stored theme', () => {
    storeTheme('moss');
    expect(readStoredTheme()).toBe('moss');
  });
});
