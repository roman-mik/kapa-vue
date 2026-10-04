<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TrackedOccurrence } from '@roman-mik/kapa-core/horizon';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { usePaymentTracking } from '@/composables/usePaymentTracking';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
const tracking = usePaymentTracking();
const action = usePaymentActionSheet();
const historyState = ref('all');
const from = ref('');
const to = ref('');
const count = ref(25);
const pending = computed(() =>
  (tracking.context.value?.occurrences ?? []).filter(
    (p) => p.state === 'expected' || p.state === 'postponed'
  )
);
const today = computed(() => tracking.context.value?.today ?? '');
const due = (p: TrackedOccurrence) => p.postponedDate ?? p.expected.date;
const needsReview = computed(() =>
  (tracking.context.value?.occurrences ?? [])
    .filter(
      (p) => p.needsReview || (['expected', 'postponed'].includes(p.state) && due(p) < today.value)
    )
    .sort((a, b) => due(a).localeCompare(due(b)))
);
const upcoming = computed(() =>
  pending.value
    .filter((p) => !needsReview.value.some((r) => r.id === p.id))
    .sort((a, b) => due(a).localeCompare(due(b)))
);
const past = computed(() =>
  (tracking.context.value?.occurrences ?? [])
    .filter(
      (p) =>
        ['completed', 'cancelled'].includes(p.state) &&
        (historyState.value === 'all' || p.state === historyState.value) &&
        (!from.value || (p.actual?.date ?? due(p)) >= from.value) &&
        (!to.value || (p.actual?.date ?? due(p)) <= to.value)
    )
    .sort((a, b) => (b.actual?.date ?? due(b)).localeCompare(a.actual?.date ?? due(a)))
);
function label(p: TrackedOccurrence) {
  if (p.state === 'completed') return p.expected.amountMinor < 0 ? 'Paid' : 'Received';
  if (p.state === 'cancelled') return 'Cancelled';
  if (due(p) < today.value)
    return p.expected.amountMinor < 0 ? 'Overdue · due now' : 'Overdue · income not assumed';
  return p.state === 'postponed' ? 'Postponed' : 'Expected';
}
</script>
<template>
  <section class="payments" aria-labelledby="payments-title">
    <h2 id="payments-title">Payments</h2>
    <p>Manage one payment at a time. Recurring sources stay in Money.</p>
    <p v-if="tracking.loading.value && !tracking.context.value" role="status">Loading payments…</p>
    <p v-if="tracking.error.value" role="alert">
      {{ tracking.error.value }}
      <BaseButton variant="secondary" @click="tracking.refresh">Retry payments</BaseButton>
    </p>
    <template v-if="tracking.context.value?.state">
      <section
        v-for="group in [
          { title: 'Needs review', items: needsReview },
          { title: 'Upcoming', items: upcoming },
        ]"
        :key="group.title"
      >
        <h3>{{ group.title }}</h3>
        <p v-if="!group.items.length">
          {{
            group.title === 'Needs review' ? 'No payments need review.' : 'No upcoming payments.'
          }}
        </p>
        <ul v-else>
          <li v-for="p in group.items" :key="p.id">
            <button type="button" @click="action.open(p.id)">
              <span class="name">{{ p.expected.label }}</span
              ><span>{{ label(p) }} · {{ formatFullDate(due(p)) }}</span
              ><span class="amount">{{
                formatMoney(
                  p.actual?.amountMinor ?? p.expected.amountMinor,
                  (p.actual?.currency ?? p.expected.currency) as Currency
                )
              }}</span>
            </button>
          </li>
        </ul>
      </section>
      <details>
        <summary>Payment history ({{ past.length }})</summary>
        <div class="filters">
          <label for="payment-history-state"
            >Status<BaseSelect id="payment-history-state" v-model="historyState"
              ><option value="all">Paid, received and cancelled</option>
              <option value="completed">Paid and received</option>
              <option value="cancelled">Cancelled</option></BaseSelect
            ></label
          ><label for="payment-history-from"
            >From<BaseInput id="payment-history-from" v-model="from" type="date" /></label
          ><label for="payment-history-to"
            >To<BaseInput id="payment-history-to" v-model="to" type="date"
          /></label>
        </div>
        <p v-if="!past.length">No matching payment history.</p>
        <ul v-else>
          <li v-for="p in past.slice(0, count)" :key="p.id">
            <button type="button" @click="action.open(p.id)">
              <span class="name">{{ p.expected.label }}</span
              ><span>{{ label(p) }} · {{ formatFullDate(p.actual?.date ?? due(p)) }}</span
              ><span class="amount">{{
                formatMoney(
                  p.actual?.amountMinor ?? p.expected.amountMinor,
                  (p.actual?.currency ?? p.expected.currency) as Currency
                )
              }}</span>
            </button>
          </li>
        </ul>
        <BaseButton v-if="past.length > count" variant="secondary" @click="count += 25"
          >Show more payments</BaseButton
        >
      </details>
    </template>
    <template v-else-if="!tracking.loading.value"
      ><p>Check your bank balances to start tracking actual payments.</p>
      <BaseButton variant="secondary" @click="usePaymentLinkSheet().open()"
        >Check balances</BaseButton
      ></template
    >
  </section>
</template>
<style scoped>
.payments {
  margin-block: var(--kapa-space-5);
}
ul {
  list-style: none;
  padding: 0;
}
li {
  border-bottom: 1px solid var(--kapa-neutral-400);
}
li button {
  display: grid;
  gap: var(--kapa-space-1);
  width: 100%;
  min-height: 44px;
  text-align: left;
  background: none;
  border: 0;
  color: var(--kapa-text);
  padding: var(--kapa-space-3) 0;
  cursor: pointer;
  font: inherit;
  overflow-wrap: anywhere;
}
.name {
  font-weight: 600;
}
.amount {
  font-variant-numeric: tabular-nums;
}
.filters {
  display: grid;
  gap: var(--kapa-space-3);
}
label {
  display: grid;
  gap: var(--kapa-space-2);
}
summary {
  min-height: 44px;
  padding-block: var(--kapa-space-3);
  cursor: pointer;
}
</style>
