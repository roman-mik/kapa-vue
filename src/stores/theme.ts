import type { ThemeId } from '@roman-mik/kapa-core/theme';
import { defineStore } from 'pinia';
import { applyTheme, DEFAULT_THEME, readStoredTheme, storeTheme } from '@/lib/theme';

export const useThemeStore = defineStore('theme', {
  state: () => ({
    id: DEFAULT_THEME as ThemeId,
  }),
  actions: {
    // Reads the localStorage value the pre-paint inline script in index.html
    // already applied to <html data-theme>, syncing Pinia's state to match
    // what's already on screen (no re-apply needed for the initial render).
    init(): void {
      this.id = readStoredTheme();
    },
    // User-driven switch: updates the DOM attribute, persists to
    // localStorage, and once task 9/10 wire up the session, also gets
    // called to reconcile against core.profiles.theme after auth resolves.
    setTheme(id: ThemeId): void {
      this.id = id;
      applyTheme(id);
      storeTheme(id);
    },
  },
});
