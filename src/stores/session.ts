import type { Session, User } from '@supabase/supabase-js';
import { defineStore } from 'pinia';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

export const useSessionStore = defineStore('session', {
  state: () => ({
    user: null as User | null,
    // Undetermined until the first onAuthStateChange fires (or getSession()
    // resolves) — the router guard waits on this instead of treating
    // "no user yet" as "not logged in" and bouncing a page mid-restore.
    ready: false,
  }),
  actions: {
    // Called once from main.ts before the router starts navigating.
    async init(): Promise<void> {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      this.user = session?.user ?? null;
      this.ready = true;

      supabase.auth.onAuthStateChange((_event, session: Session | null) => {
        this.user = session?.user ?? null;
      });
    },
    async signInWithPassword(email: string, password: string): Promise<void> {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      this.user = data.user;
    },
    async signOut(): Promise<void> {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      this.user = null;
      // Clears the previous user's spaces so a different account signing
      // in on the same device never briefly sees a stale space list.
      useSpaceStore().reset();
    },
  },
});
