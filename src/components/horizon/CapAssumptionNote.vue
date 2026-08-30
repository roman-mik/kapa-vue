<script setup lang="ts">
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { formatMoney } from '@/lib/money';

// A-CAP-1: the projection reuses the space's *current* cap for every future
// month, including months whose cap will presumably be renegotiated. Stated
// here rather than left implicit — see docs/kapa-vue/plans/2026-08-30-horizon-features.md §3.
defineProps<{
  capMinor: number | null;
  currency: Currency;
}>();
</script>

<template>
  <p v-if="capMinor !== null" role="status" class="cap-note">
    Assumes today's {{ formatMoney(capMinor, currency) }} cap continues for every future month.
  </p>
</template>

<style scoped>
.cap-note {
  margin: 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}
</style>
