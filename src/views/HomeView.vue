<script setup lang="ts">
import { THEME_IDS, themes } from "@roman-mik/kapa-core/theme";
import { useRouter } from "vue-router";
import { useSessionStore } from "@/stores/session";
import { useSpaceStore } from "@/stores/space";
import { useThemeStore } from "@/stores/theme";

// Temporary — proves task 8's theme switching, task 9's auth, and task 10's
// space selection end to end. Replaced by SettingsView (theme) and real
// Pocket screens (task 11).
const theme = useThemeStore();
const session = useSessionStore();
const space = useSpaceStore();
const router = useRouter();

async function onSignOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: "login" });
}
</script>

<template>
  <main>
    <h1>kapa-vue</h1>
    <p>Signed in as {{ session.user?.email }}</p>
    <p>
      Space: {{ space.currentSpace?.name }}
      <router-link to="/spaces">Switch</router-link>
    </p>
    <p>Pick a theme to confirm it restyles instantly with no flash on reload.</p>
    <div class="switcher">
      <button
        v-for="id in THEME_IDS"
        :key="id"
        type="button"
        :aria-pressed="theme.id === id"
        @click="theme.setTheme(id)"
      >
        {{ themes[id].name }}
      </button>
    </div>
    <button type="button" class="sign-out" @click="onSignOut">Sign out</button>
  </main>
</template>

<style scoped>
main {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  padding: 2rem;
}

.switcher {
  display: flex;
  gap: 0.5rem;
}

button {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
}

button[aria-pressed="true"] {
  border-color: var(--kapa-accent);
  color: var(--kapa-accent-700);
  background: var(--kapa-accent-100);
}

.sign-out {
  margin-top: 1rem;
}
</style>
