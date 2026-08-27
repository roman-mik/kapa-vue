import { updateTheme } from '@roman-mik/kapa-core/core';
import type { ThemeId } from '@roman-mik/kapa-core/theme';
import { defineStore } from 'pinia';
import { applyTheme, DEFAULT_THEME, readStoredTheme, storeTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';

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
    // localStorage, and — when signed in — to core.profiles.theme, so the
    // choice follows the user to their next device.
    async setTheme(id: ThemeId): Promise<void> {
      this.id = id;
      applyTheme(id);
      storeTheme(id);
      const session = useSessionStore();
      if (session.user) {
        await updateTheme(supabase, session.user.id, id);
      }
    },
    // Called from space.init() once the profile is known, to reconcile a
    // theme chosen on a different device. Applies locally only — this is a
    // read of the already-persisted choice, not a new one to write back.
    applyRemote(id: ThemeId): void {
      this.id = id;
      applyTheme(id);
      storeTheme(id);
    },
  },
});
