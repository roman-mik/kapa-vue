<script setup lang="ts">
import { THEME_IDS, themes } from '@roman-mik/kapa-core/theme';
import { listExpenses } from '@roman-mik/kapa-core/pocket/queries';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { expensesToCsv } from '@/lib/csv';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { useThemeStore } from '@/stores/theme';
import { useToast } from '@/composables/useToast';
import { useInstallPrompt } from '@/composables/useInstallPrompt';

const theme = useThemeStore();
const space = useSpaceStore();
const session = useSessionStore();
const router = useRouter();
const toast = useToast();
const { canInstall, installed, promptInstall } = useInstallPrompt();

const exporting = ref(false);

async function onSignOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: 'login' });
}

async function onExport(): Promise<void> {
  const spaceId = space.currentSpaceId;
  if (!spaceId) return;
  exporting.value = true;
  try {
    const rows = await listExpenses(supabase, spaceId);
    const csv = expensesToCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kapa-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't export.");
  } finally {
    exporting.value = false;
  }
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

    <BaseCard v-if="canInstall && !installed" padding="sm" class="section">
      <h2>App</h2>
      <BaseButton variant="secondary" block @click="promptInstall">Install app</BaseButton>
    </BaseCard>

    <BaseCard padding="sm" class="section">
      <h2>Data</h2>
      <BaseButton variant="secondary" block :disabled="exporting" @click="onExport">
        {{ exporting ? 'Exporting…' : 'Export CSV' }}
      </BaseButton>
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
