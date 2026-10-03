<script setup lang="ts">
import type { Currency, FxRate } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { formatFullDate } from '@/lib/date';
import { formatRate } from '@/lib/money';

const props = defineProps<{
  spaceCurrency: Currency;
  // Distinct foreign currencies in use among this view's accounts, ascending.
  currencies: Currency[];
  rateFor: (currency: Currency) => FxRate | null;
  loading: boolean;
}>();

const emit = defineEmits<{ refresh: [] }>();

// One row per pair; the rate lookup happens here (script), not the template,
// per the no-derivation-in-templates rule the rest of Horizon follows.
const rows = computed(() =>
  props.currencies.map((currency) => {
    const rate = props.rateFor(currency);
    return {
      currency,
      pair: `${currency} → ${props.spaceCurrency}`,
      rate: rate ? formatRate(rate) : null,
      date: rate ? formatFullDate(rate.rateDate) : null,
    };
  })
);
</script>

<template>
  <BaseCard class="panel">
    <div class="panel-head">
      <h2>FX snapshot</h2>
      <p class="hint">
        Prices every converted balance above — a dated snapshot, never a live rate.
      </p>
    </div>

    <p v-if="rows.length === 0" class="hint">No foreign-currency accounts to convert.</p>

    <div v-else class="rows">
      <div v-for="row in rows" :key="row.currency" class="row">
        <span class="pair">{{ row.pair }}</span>
        <span v-if="row.rate && row.date" class="rate-block">
          <span class="rate">{{ row.rate }}</span>
          <span class="date">as of {{ row.date }}</span>
        </span>
        <span v-else class="unavailable">no rate available</span>
      </div>
    </div>

    <BaseButton variant="secondary" :disabled="loading" @click="emit('refresh')">
      {{ loading ? 'Refreshing…' : 'Refresh' }}
    </BaseButton>
  </BaseCard>
</template>

<style scoped>
.panel {
  padding: var(--kapa-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.panel-head h2 {
  margin: 0 0 var(--kapa-space-1);
  font-family: var(--font-heading);
  font-size: var(--kapa-text-lg-size);
  color: var(--kapa-ink);
}

.hint {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
  margin: 0;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--kapa-space-2);
  padding-bottom: var(--kapa-space-2);
  border-bottom: 1px solid var(--kapa-neutral-200);
}

.row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.pair {
  font-weight: 600;
  color: var(--kapa-ink);
}

.rate-block {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.rate {
  font-weight: 600;
  color: var(--kapa-ink);
}

.date {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.unavailable {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}
</style>
