<script setup lang="ts">
import { THEME_IDS, themes } from '@roman-mik/kapa-core/theme';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { useThemeStore } from '@/stores/theme';

const theme = useThemeStore();
const space = useSpaceStore();
const session = useSessionStore();
const router = useRouter();

async function onSignOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: 'login' });
}
</script>

<template>
  <main class="page settings">
    <h1>Settings</h1>

    <BaseCard padding="sm" class="section">
      <h2>Space</h2>
      <p class="value">{{ space.currentSpace?.name }}</p>
      <router-link to="/spaces">Switch space</router-link>
    </BaseCard>

    <BaseCard padding="sm" class="section">
      <h2>Theme</h2>
      <div class="theme-switcher">
        <button
          v-for="id in THEME_IDS"
          :key="id"
          type="button"
          class="theme-btn"
          :aria-pressed="theme.id === id"
          @click="theme.setTheme(id)"
        >
          {{ themes[id].name }}
        </button>
      </div>
    </BaseCard>

    <BaseButton variant="secondary" block @click="onSignOut">Sign out</BaseButton>
  </main>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.section h2 {
  margin: 0 0 var(--kapa-space-2);
}

.value {
  margin: 0 0 var(--kapa-space-2);
  color: var(--kapa-ink);
}

.theme-switcher {
  display: flex;
  gap: var(--kapa-space-2);
}

.theme-btn {
  font: inherit;
  font-size: var(--kapa-text-caption-size);
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-bg);
  color: var(--kapa-ink);
  cursor: pointer;
}

.theme-btn[aria-pressed='true'] {
  border-color: var(--kapa-accent);
  color: var(--kapa-accent-700);
  background: var(--kapa-accent-100);
}
</style>
