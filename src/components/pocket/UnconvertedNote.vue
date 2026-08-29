<script setup lang="ts">
import type { Currency, CurrencyBucket } from '@roman-mik/kapa-core/pocket';
import { formatMoney } from '@/lib/money';

// Shared wording for "these amounts couldn't be converted" across Home and
// History — both surface the same underlying condition (a foreign-currency
// row with no `core.fx_rates` snapshot covering its spend date) and should
// read the same. `context` is the tail clause naming what the excluded
// amounts are missing from, e.g. "above", "in this breakdown", "in this list".
defineProps<{
  buckets: CurrencyBucket[];
  currency: Currency;
  context: string;
}>();
</script>

<template>
  <p v-if="buckets.length" role="status" class="unconverted-note">
    {{ buckets.map((b) => formatMoney(b.amountMinor, b.currency)).join(' + ') }}
    couldn't be converted to {{ currency }} and
    {{ buckets.length === 1 ? "isn't" : "aren't" }} included {{ context }}.
  </p>
</template>

<style scoped>
.unconverted-note {
  margin: 0;
  color: var(--kapa-negative);
  font-size: var(--kapa-text-caption-size);
}
</style>
