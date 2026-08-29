<script setup lang="ts">
import { THEME_IDS, themes } from '@roman-mik/kapa-core/theme';
import { listExpenses } from '@roman-mik/kapa-core/pocket/queries';
import { ref, watch, computed } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { expensesToCsv } from '@/lib/csv';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { useThemeStore } from '@/stores/theme';
import { useToast } from '@/composables/useToast';
import { useInstallPrompt } from '@/composables/useInstallPrompt';
import { displayNameSchema, firstIssueMessage } from '@/lib/validation';

const theme = useThemeStore();
const space = useSpaceStore();
const session = useSessionStore();
const router = useRouter();
const toast = useToast();
const { canInstall, installed, promptInstall } = useInstallPrompt();

const exporting = ref(false);

const displayNameInput = ref(space.displayName ?? '');

watch(
  () => space.displayName,
  (val) => {
    displayNameInput.value = val ?? '';
  },
  { immediate: true }
);

const isClean = computed(() => {
  const current = (space.displayName ?? '').trim();
  const input = displayNameInput.value.trim();
  return current === input;
});

const profileError = ref<string | null>(null);
const profileBusy = ref(false);

async function onProfileSubmit(): Promise<void> {
  profileError.value = null;
  const parsed = displayNameSchema.safeParse(displayNameInput.value);
  if (!parsed.success) {
    profileError.value = firstIssueMessage(parsed) ?? 'Invalid display name.';
    return;
  }

  profileBusy.value = true;
  try {
    await space.setDisplayName(parsed.data);
    toast.success('Display name updated');
  } catch (err) {
    profileError.value = err instanceof Error ? err.message : "Couldn't update display name.";
    toast.error(profileError.value);
  } finally {
    profileBusy.value = false;
  }
}

async function onSignOut(): Promise<void> {
  await session.signOut();
  await router.replace({ name: 'login' });
}

async function onExport(): Promise<void> {
  const spaceId = space.currentSpaceId;
  if (!spaceId) return;
  exporting.value = true;
  try {
    // Intentionally all-time (tracker's /api/export does the same), matching
    // the "kapa-<date>.csv" full-history download. listExpenses is
    // unpaginated, which is fine at this space's scale; revisit with a
    // date-range filter + pagination if a space ever grows large.
    const rows = await listExpenses(supabase, spaceId);
    const csv = expensesToCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `kapa-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Defer revoking so the browser snapshots the blob before it can be
    // dropped — an immediate revoke can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 0);
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
      <h2>Profile</h2>
      <form @submit.prevent="onProfileSubmit" class="profile-form">
        <BaseField label="Display name" v-slot="{ id }">
          <BaseInput
            :id="id"
            v-model="displayNameInput"
            type="text"
            maxlength="60"
            placeholder="No display name"
          />
        </BaseField>
        <p v-if="profileError" role="alert" class="error">{{ profileError }}</p>
        <BaseButton type="submit" block :disabled="profileBusy || isClean">
          {{ profileBusy ? 'Saving…' : 'Save changes' }}
        </BaseButton>
      </form>
    </BaseCard>

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
          @click="theme.setTheme(id, session.user?.id)"
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

.profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
