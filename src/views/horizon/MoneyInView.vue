<script setup lang="ts">
import { type Currency, type CurrencyBucket } from '@roman-mik/kapa-core/pocket';
import { formatMonthLabel } from '@roman-mik/kapa-core/horizon/incomeMath';
import { computed } from 'vue';
import IncomeStreamForm from '@/components/horizon/IncomeStreamForm.vue';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useConvertedAmount } from '@/composables/useConvertedAmount';
import {
  streamKindLabel,
  useIncomeStreams,
  type IncomeStreamMonth,
} from '@/composables/useIncomeStreams';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { useSpaceStore } from '@/stores/space';

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function prettyDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${MONTH_LABELS[Number(month) - 1]} ${Number(day)}`;
}

const space = useSpaceStore();
const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

const { streamsWithMonth, convertibles, month, loading, error, add } = useIncomeStreams();
const { accounts } = useAccounts();
const { convertedMinor, spaceCurrencyAmount, unconvertible } = useConvertedAmount(convertibles);

const monthLabel = computed(() => (month.value ? formatMonthLabel(month.value) : ''));

// Every active stream counts at its space-currency figure; an unconvertible
// foreign stream contributes nothing and is surfaced in the note below.
const totalMinor = computed(() =>
  convertibles.value.reduce((sum, item) => sum + (spaceCurrencyAmount(item) ?? 0), 0)
);

const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const item of unconvertible.value) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amountMinor);
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  expected: 'Expected',
  uncertain: 'Uncertain',
};

const RECURRENCE_LABELS: Record<string, string> = {
  recurring: 'Recurring',
  oneOff: 'One-off',
};

const toast = useToast();

function onSaved(): void {
  toast.success('Income added');
}

function native(stream: IncomeStreamMonth, amountMinor: number): string {
  return formatMoney(amountMinor, stream.currency as Currency);
}
</script>

<template>
  <main class="page">
    <h1>Money in</h1>

    <div class="hero">
      <span class="hero-label">Expected in {{ monthLabel }}</span>
      <span class="hero-amount">{{ formatMoney(totalMinor, spaceCurrency) }}</span>
      <UnconvertedNote
        :buckets="unconvertibleBuckets"
        :currency="spaceCurrency"
        context="in this month\u2019s income"
      />
    </div>

    <template v-if="loading && !streamsWithMonth.length">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <IncomeStreamForm
        :accounts="accounts.filter((a) => !a.archived)"
        :space-currency="spaceCurrency"
        :default-start-date="month ? `${month}-01` : ''"
        :save="add"
        @saved="onSaved"
      />

      <EmptyState
        v-if="!streamsWithMonth.length"
        title="No income streams yet"
        message="Add the money that comes in and see what each month is worth."
      />

      <ul v-else class="list">
        <li v-for="stream in streamsWithMonth" :key="stream.id" class="row">
          <div class="row-info">
            <span class="row-name">{{ stream.name }}</span>
            <span class="badges">
              <span class="badge">{{ streamKindLabel(stream.kind) }}</span>
              <span v-if="CONFIDENCE_LABELS[stream.confidence]" class="badge muted">
                {{ CONFIDENCE_LABELS[stream.confidence] }}
              </span>
              <span v-if="RECURRENCE_LABELS[stream.recurrence]" class="badge muted">
                {{ RECURRENCE_LABELS[stream.recurrence] }}
              </span>
            </span>
          </div>

          <span class="row-total">
            <span class="native">{{ native(stream, stream.monthlyMinor) }}</span>
            <span
              v-if="
                convertedMinor({
                  id: stream.id,
                  currency: stream.currency as Currency,
                  amountMinor: stream.monthlyMinor,
                }) !== null
              "
              class="converted"
            >
              ≈
              {{
                formatMoney(
                  convertedMinor({
                    id: stream.id,
                    currency: stream.currency as Currency,
                    amountMinor: stream.monthlyMinor,
                  })!,
                  spaceCurrency
                )
              }}
            </span>
          </span>

          <ul v-if="stream.occurrences.length" class="payments">
            <li v-for="occurrence in stream.occurrences" :key="occurrence.date" class="payment">
              <span class="payment-date">
                {{ prettyDate(occurrence.date) }}
                <span v-if="occurrence.shifted" class="shifted"
                  >was {{ prettyDate(occurrence.originalDate!) }}</span
                >
              </span>
              <span class="payment-amount">{{ native(stream, occurrence.amountMinor) }}</span>
              <span class="payment-period">{{ occurrence.periodLabel }}</span>
            </li>
          </ul>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
  margin-bottom: var(--kapa-space-5);
}

.hero-label {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-amount {
  font-family: var(--font-heading);
  font-size: var(--kapa-text-display-size);
  color: var(--kapa-ink);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--kapa-space-3);
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
  min-width: 0;
}

.row-name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.badges {
  display: flex;
  gap: var(--kapa-space-1);
}

.badge {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  padding: 0 var(--kapa-space-2);
  border-radius: var(--kapa-radius-sm);
  background: var(--kapa-neutral-400);
  color: var(--kapa-ink-muted);
}

.badge.muted {
  background: transparent;
  color: var(--kapa-ink-muted);
}

.row-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  margin-left: auto;
  color: var(--kapa-ink);
  font-weight: 600;
}

.converted {
  font-size: var(--kapa-text-caption-size);
  font-weight: 400;
  color: var(--kapa-ink-muted);
}

.payments {
  list-style: none;
  margin: 0;
  padding: 0;
  flex-basis: 100%;
  border-top: 1px solid var(--kapa-neutral-400);
  padding-top: var(--kapa-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.payment {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-2);
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.payment-date {
  min-width: 5.5em;
}

.shifted {
  color: var(--kapa-ink-muted);
}

.payment-amount {
  margin-left: auto;
  color: var(--kapa-ink);
  font-weight: 600;
}

.payment-period {
  min-width: 5em;
  text-align: right;
}
</style>
