import type { Space } from "@roman-mik/kapa-core/core";
import {
  getProfile,
  joinSpace,
  leaveSpace,
  listMySpaces,
  updateLastActiveSpace,
} from "@roman-mik/kapa-core/core";
import { defineStore } from "pinia";
import { supabase } from "@/lib/supabase";
import { useSessionStore } from "@/stores/session";

export const useSpaceStore = defineStore("space", {
  state: () => ({
    spaces: [] as Space[],
    currentSpaceId: null as string | null,
    ready: false,
  }),
  getters: {
    currentSpace(state): Space | null {
      return state.spaces.find((space) => space.id === state.currentSpaceId) ?? null;
    },
  },
  actions: {
    // Called once from main.ts, after session.init(), so RLS sees an
    // authenticated caller. Every Pocket query is space-scoped, so the
    // router guard below waits on `ready` before deciding whether a space
    // still needs picking.
    async init(): Promise<void> {
      const session = useSessionStore();
      if (!session.user) return;

      const [spaces, profile] = await Promise.all([
        listMySpaces(supabase),
        getProfile(supabase, session.user.id),
      ]);
      this.spaces = spaces;

      const lastActive = profile?.last_active_space_id ?? null;
      if (lastActive && spaces.some((space) => space.id === lastActive)) {
        this.currentSpaceId = lastActive;
      } else if (spaces.length === 1) {
        // Auto-select the only space and persist it, so the choice is
        // already settled on the next login instead of re-deriving it
        // from "exactly one space" every time.
        await this.selectSpace(spaces[0].id);
      } else {
        this.currentSpaceId = null;
      }
      this.ready = true;
    },
    // User- or auto-driven pick: persists to core.profiles.last_active_space_id
    // rather than a parallel localStorage key, so the choice follows the
    // user across devices.
    async selectSpace(spaceId: string): Promise<void> {
      const session = useSessionStore();
      if (!session.user) return;

      this.currentSpaceId = spaceId;
      await updateLastActiveSpace(supabase, session.user.id, spaceId);
    },
    async join(inviteCode: string): Promise<void> {
      const spaceId = await joinSpace(supabase, inviteCode);
      this.spaces = await listMySpaces(supabase);
      if (spaceId) await this.selectSpace(spaceId);
    },
    async leave(spaceId: string): Promise<void> {
      await leaveSpace(supabase, spaceId);
      this.spaces = await listMySpaces(supabase);

      if (this.currentSpaceId !== spaceId) return;
      this.currentSpaceId = null;
      if (this.spaces.length === 1) await this.selectSpace(this.spaces[0].id);
    },
    reset(): void {
      this.spaces = [];
      this.currentSpaceId = null;
      this.ready = false;
    },
  },
});
