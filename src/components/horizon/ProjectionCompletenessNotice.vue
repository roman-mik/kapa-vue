<script setup lang="ts">
import { ref, watch } from 'vue';
import type { Currency, CurrencyBucket } from '@roman-mik/kapa-core/pocket';
import BaseButton from '@/components/ui/BaseButton.vue';
import { formatMoney } from '@/lib/money';

const props = withDefaults(
  defineProps<{
    issues?: CurrencyBucket[];
    currency: Currency;
    loading?: boolean;
    error?: string | null;
  }>(),
  { issues: () => [], loading: false, error: null }
);
defineEmits<{ retry: []; inspect: [] }>();
const root = ref<HTMLElement | null>(null);
const retryHeight = ref<number | null>(null);
watch(
  () => props.loading,
  (loading) => {
    retryHeight.value = loading && root.value ? root.value.getBoundingClientRect().height : null;
  }
);
watch(
  () => props.loading || !!props.error || props.issues.length > 0,
  (visible, previous) => {
    if (previous && !visible && root.value?.contains(document.activeElement)) {
      const target =
        root.value.closest('.sheet-panel')?.querySelector<HTMLElement>('[data-autofocus]') ??
        root.value.closest('main')?.querySelector<HTMLElement>('h1[tabindex]');
      target?.focus();
    }
  }
);
</script>

<template>
  <section
    v-if="loading || error || issues.length"
    ref="root"
    class="notice"
    aria-label="Forecast status"
    :aria-busy="loading"
    :style="retryHeight ? { minHeight: `${retryHeight}px` } : undefined"
  >
    <p class="title" role="status">
      {{ loading ? 'Updating forecast…' : error ? 'Forecast unavailable' : 'Forecast incomplete' }}
    </p>
    <template v-if="!loading">
      <p v-if="error">Your forecast could not be loaded. Your entered amounts are preserved.</p>
      <template v-else>
        <p>
          Some amounts could not be converted to {{ currency }}. Projected balances are partial.
        </p>
        <ul aria-label="Amounts without exchange rates">
          <li v-for="issue in issues" :key="issue.currency">
            {{ formatMoney(issue.amountMinor, issue.currency) }} ({{ issue.currency }})
          </li>
        </ul>
        <p class="hint">These are reported unconverted amounts, not a net shortfall.</p>
      </template>
    </template>
    <p class="hint">
      Retry reloads available exchange rates. A missing rate may still need to be added.
    </p>
    <div class="actions">
      <BaseButton variant="secondary" :aria-disabled="loading" @click="!loading && $emit('retry')"
        >Retry forecast</BaseButton
      >
      <router-link :to="{ name: 'horizon-accounts' }" @click="$emit('inspect')"
        >View exchange rates</router-link
      >
    </div>
  </section>
</template>

<style scoped>
.notice {
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  padding: var(--kapa-space-4);
  margin-bottom: var(--kapa-space-4);
  overflow-wrap: anywhere;
}
p {
  margin: 0 0 var(--kapa-space-2);
}
.title {
  font-weight: 700;
}
ul {
  padding-left: var(--kapa-space-5);
  margin: 0 0 var(--kapa-space-2);
}
.hint {
  font-size: var(--kapa-text-caption-size);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--kapa-space-2);
}
.actions :deep(button),
.actions :deep(button) {
  border-color: var(--kapa-ink-muted);
}
.actions a {
  text-decoration: underline;
  min-height: 44px;
  min-width: 44px;
}
.actions a {
  display: inline-flex;
  align-items: center;
  color: var(--kapa-ink);
  padding: 0 var(--kapa-space-2);
  text-underline-offset: 3px;
}
.actions :deep(button:focus-visible),
.actions a:focus-visible {
  outline: 2px solid var(--kapa-ink);
  outline-offset: 3px;
}
</style>

<style scoped>
.actions :deep(button[aria-disabled='true']) {
  opacity: 0.6;
  cursor: default;
}
</style>
