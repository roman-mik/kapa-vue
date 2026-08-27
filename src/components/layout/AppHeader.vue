<script setup lang="ts">
import { THEME_IDS, themes } from '@roman-mik/kapa-core/theme';
import { useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { useThemeStore } from '@/stores/theme';

const theme = useThemeStore();
const session = useSessionStore();
const space = useSpaceStore();
const router = useRouter();

async function onSignOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <header class="app-header">
    <nav class="links">
      <router-link to="/">Home</router-link>
      <router-link to="/pocket/history">History</router-link>
      <router-link to="/pocket/categories">Categories</router-link>
      <router-link to="/pocket/cap">Cap</router-link>
    </nav>
    <div class="controls">
      <span class="space">
        {{ space.currentSpace?.name }}
        <router-link to="/spaces">Switch</router-link>
      </span>
      <div class="theme-switcher">
        <button
          v-for="id in THEME_IDS"
          :key="id"
          type="button"
          :aria-pressed="theme.id === id"
          :title="themes[id].name"
          @click="theme.setTheme(id)"
        >
          {{ themes[id].name }}
        </button>
      </div>
      <button type="button" class="sign-out" @click="onSignOut">Sign out</button>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
}

.links {
  display: flex;
  gap: 1rem;
}

.links a {
  color: var(--kapa-ink-muted);
  text-decoration: none;
  font-size: 0.9rem;
}

.links a.router-link-active {
  color: var(--kapa-accent-700);
  font-weight: 600;
}

.controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.85rem;
  color: var(--kapa-ink-muted);
}

.space a {
  margin-left: 0.25rem;
  color: var(--kapa-accent-700);
}

.theme-switcher {
  display: flex;
  gap: 0.25rem;
}

.theme-switcher button,
.sign-out {
  font: inherit;
  font-size: 0.8rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
}

.theme-switcher button[aria-pressed='true'] {
  border-color: var(--kapa-accent);
  color: var(--kapa-accent-700);
  background: var(--kapa-accent-100);
}
</style>
