<script setup lang="ts">
import { type Currency, type CurrencyBucket, zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import type { ChargeCadence } from '@roman-mik/kapa-core/horizon';
import ObligationForm from '@/components/horizon/ObligationForm.vue';
import OneOffEventForm from '@/components/horizon/OneOffEventForm.vue';
import PlannedSpendForm from '@/components/horizon/PlannedSpendForm.vue';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useCategories } from '@/composables/useCategories';
import { useConvertedAmount } from '@/composables/useConvertedAmount';
import {
  OBLIGATION_CATEGORY_LABELS,
  useObligations,
  type ObligationCategory,
  type ObligationMonth,
} from '@/composables/useObligations';
import {
  ONE_OFF_CATEGORY_LABELS,
  useOneOffEvents,
  type OneOffCategory,
} from '@/composables/useOneOffEvents';
import { usePlannedSpend } from '@/composables/usePlannedSpend';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { useSpaceStore } from '@/stores/space';

const CADENCE_LABELS: Record<ChargeCadence, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function categoryLabel(category: string): string {
  return OBLIGATION_CATEGORY_LABELS[category as ObligationCategory] ?? category;
}

function oneOffCategoryLabel(category: string): string {
  return ONE_OFF_CATEGORY_LABELS[category as OneOffCategory] ?? category;
}

function cadenceLabel(cadence: string): string {
  return CADENCE_LABELS[cadence as ChargeCadence] ?? cadence;
}

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

const { obligationsWithMonth, convertibles, month, loading, error, add } = useObligations();
const {
  monthOneOffs,
  convertibles: oneOffConvertibles,
  loading: oneOffsLoading,
  error: oneOffsError,
  add: addOneOff,
  update: updateOneOff,
  remove: removeOneOff,
} = useOneOffEvents();
const {
  itemsWithMonth: plannedSpendWithMonth,
  convertibles: plannedSpendConvertibles,
  loading: plannedSpendLoading,
  error: plannedSpendError,
  add: addPlannedSpend,
} = usePlannedSpend();
const { accounts } = useAccounts();
const { categories } = useCategories();
const { convertedMinor, spaceCurrencyAmount, unconvertible } = useConvertedAmount(convertibles);
const { convertedMinor: convertedOneOffMinor } = useConvertedAmount(oneOffConvertibles);
const {
  convertedMinor: convertedPlannedSpendMinor,
  spaceCurrencyAmount: plannedSpendSpaceCurrencyAmount,
  unconvertible: plannedSpendUnconvertible,
} = useConvertedAmount(plannedSpendConvertibles);

function categoryName(categoryId: string | null): string {
  if (!categoryId) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

const defaultOneOffDate = computed(() =>
  space.currentSpace ? zonedDateKey(new Date(), space.currentSpace.timezone) : ''
);

const monthLabel = computed(() => {
  if (!month.value) return '';
  const [, month1] = month.value.split('-');
  return `${MONTH_LABELS[Number(month1) - 1]}`;
});

// Every active obligation and planned-spend item counts at its space-currency
// figure — both are recurring/budgeted, unlike one-offs, which are one-time
// and deliberately excluded from this total. An unconvertible foreign item
// contributes nothing and is surfaced in the note below.
const totalMinor = computed(
  () =>
    convertibles.value.reduce((sum, item) => sum + (spaceCurrencyAmount(item) ?? 0), 0) +
    plannedSpendConvertibles.value.reduce(
      (sum, item) => sum + (plannedSpendSpaceCurrencyAmount(item) ?? 0),
      0
    )
);

const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const item of [...unconvertible.value, ...plannedSpendUnconvertible.value]) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amountMinor);
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

const toast = useToast();

function onSaved(): void {
  toast.success('Obligation added');
}

function onOneOffSaved(): void {
  toast.success('One-off added');
}

const editingOneOffId = ref<string | null>(null);

function onOneOffEdited(): void {
  editingOneOffId.value = null;
  toast.success('One-off updated');
}

function onOneOffRemoved(): void {
  editingOneOffId.value = null;
  toast.success('One-off deleted');
}

function onOneOffCancelled(): void {
  editingOneOffId.value = null;
}

function onPlannedSpendSaved(): void {
  toast.success('Planned spend added');
}

function native(obligation: ObligationMonth, amountMinor: number): string {
  return formatMoney(amountMinor, obligation.currency as Currency);
}
</script>

<template>
  <main class="page">
    <h1>Money out</h1>

    <div class="hero">
      <span class="hero-label">Expected out in {{ monthLabel || 'this month' }}</span>
      <span class="hero-amount">{{ formatMoney(totalMinor, spaceCurrency) }}</span>
      <UnconvertedNote
        :buckets="unconvertibleBuckets"
        :currency="spaceCurrency"
        context="in this month\u2019s obligations"
      />
    </div>

    <template v-if="loading && !obligationsWithMonth.length">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <ObligationForm
        :accounts="accounts.filter((a) => !a.archived)"
        :space-currency="spaceCurrency"
        :default-start-date="month ? `${month}-01` : ''"
        :save="add"
        @saved="onSaved"
      />

      <EmptyState
        v-if="!obligationsWithMonth.length"
        title="No obligations yet"
        message="Add the bills you pay on a schedule and see when each one is due."
      />

      <ul v-else class="list">
        <li v-for="obligation in obligationsWithMonth" :key="obligation.id" class="row">
          <div class="row-info">
            <span class="row-name">{{ obligation.name }}</span>
            <span class="badges">
              <span class="badge">{{ categoryLabel(obligation.category) }}</span>
            </span>
          </div>

          <span class="row-total">
            <span class="native">{{ native(obligation, obligation.monthlyMinor) }}</span>
            <span
              v-if="
                convertedMinor({
                  id: obligation.id,
                  currency: obligation.currency as Currency,
                  amountMinor: obligation.monthlyMinor,
                }) !== null
              "
              class="converted"
            >
              ≈
              {{
                formatMoney(
                  convertedMinor({
                    id: obligation.id,
                    currency: obligation.currency as Currency,
                    amountMinor: obligation.monthlyMinor,
                  })!,
                  spaceCurrency
                )
              }}
            </span>
          </span>

          <ul v-if="obligation.occurrences.length" class="payments">
            <li v-for="occurrence in obligation.occurrences" :key="occurrence.date" class="payment">
              <span class="payment-date">
                {{ prettyDate(occurrence.date) }}
                <span v-if="occurrence.shifted" class="shifted"
                  >was {{ prettyDate(occurrence.originalDate!) }}</span
                >
              </span>
              <span class="payment-amount"> Due {{ occurrence.periodLabel }} </span>
            </li>
          </ul>
        </li>
      </ul>

      <h2 class="section-title">One-off events</h2>

      <OneOffEventForm
        :accounts="accounts.filter((a) => !a.archived)"
        :space-currency="spaceCurrency"
        :default-date="defaultOneOffDate"
        :save="addOneOff"
        @saved="onOneOffSaved"
      />

      <template v-if="oneOffsLoading && !monthOneOffs.length">
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="oneOffsError" role="alert" class="error">{{ oneOffsError }}</p>

      <EmptyState
        v-else-if="!monthOneOffs.length"
        title="No one-off events yet"
        message="Add a dated gift, refund, or one-time cost for this month."
      />

      <ul v-else class="list">
        <li
          v-for="event in monthOneOffs"
          :key="event.id"
          class="row"
          :class="{ editing: editingOneOffId === event.id }"
        >
          <template v-if="editingOneOffId === event.id">
            <OneOffEventForm
              class="edit-form"
              :accounts="accounts.filter((a) => !a.archived)"
              :space-currency="spaceCurrency"
              :default-date="defaultOneOffDate"
              :initial="event"
              :save="addOneOff"
              :update="updateOneOff"
              :remove="removeOneOff"
              @saved="onOneOffEdited"
              @removed="onOneOffRemoved"
              @cancelled="onOneOffCancelled"
            />
          </template>
          <template v-else>
            <div class="row-info">
              <span class="row-name">{{ event.name }}</span>
              <span class="badges">
                <span class="badge">{{ oneOffCategoryLabel(event.category) }}</span>
                <span class="badge" :class="event.direction === 'in' ? 'badge-in' : 'badge-out'">
                  {{ event.direction === 'in' ? 'In' : 'Out' }}
                </span>
                <span class="badge">{{ prettyDate(event.date) }}</span>
              </span>
            </div>

            <span class="row-total">
              <span class="native" :class="event.direction === 'in' ? 'amount-in' : 'amount-out'">
                {{ event.direction === 'in' ? '+' : '−'
                }}{{ formatMoney(event.amount_minor, event.currency as Currency) }}
              </span>
              <span
                v-if="
                  convertedOneOffMinor({
                    id: event.id,
                    currency: event.currency as Currency,
                    amountMinor: event.amount_minor,
                    asOfDate: event.date,
                  }) !== null
                "
                class="converted"
              >
                ≈
                {{
                  formatMoney(
                    convertedOneOffMinor({
                      id: event.id,
                      currency: event.currency as Currency,
                      amountMinor: event.amount_minor,
                      asOfDate: event.date,
                    })!,
                    spaceCurrency
                  )
                }}
              </span>
            </span>

            <BaseButton
              variant="ghost"
              type="button"
              class="edit-btn"
              @click="editingOneOffId = event.id"
            >
              Edit
            </BaseButton>
          </template>
        </li>
      </ul>

      <h2 class="section-title">Planned spend</h2>

      <PlannedSpendForm
        :accounts="accounts.filter((a) => !a.archived)"
        :categories="categories"
        :space-currency="spaceCurrency"
        :default-start-date="month ? `${month}-01` : ''"
        :save="addPlannedSpend"
        @saved="onPlannedSpendSaved"
      />

      <template v-if="plannedSpendLoading && !plannedSpendWithMonth.length">
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="plannedSpendError" role="alert" class="error">{{ plannedSpendError }}</p>

      <EmptyState
        v-else-if="!plannedSpendWithMonth.length"
        title="No planned spend yet"
        message="Add a category allowance or subscription bucket Pocket doesn't track per-expense."
      />

      <ul v-else class="list">
        <li v-for="item in plannedSpendWithMonth" :key="item.id" class="row">
          <div class="row-info">
            <span class="row-name">{{ item.name }}</span>
            <span class="badges">
              <span class="badge">{{ cadenceLabel(item.charge_cadence) }}</span>
              <span class="badge">{{ categoryName(item.category_id) }}</span>
            </span>
          </div>

          <span class="row-total">
            <span class="native">{{
              formatMoney(item.monthlyMinor, item.currency as Currency)
            }}</span>
            <span
              v-if="
                convertedPlannedSpendMinor({
                  id: item.id,
                  currency: item.currency as Currency,
                  amountMinor: item.monthlyMinor,
                }) !== null
              "
              class="converted"
            >
              ≈
              {{
                formatMoney(
                  convertedPlannedSpendMinor({
                    id: item.id,
                    currency: item.currency as Currency,
                    amountMinor: item.monthlyMinor,
                  })!,
                  spaceCurrency
                )
              }}
            </span>
          </span>
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

.row.editing {
  align-items: stretch;
  padding: 0;
  border-color: transparent;
  background: transparent;
}

.edit-btn {
  padding: var(--kapa-space-1) var(--kapa-space-3);
  font-weight: 600;
  border-radius: var(--kapa-radius-sm);
}

.edit-form {
  margin: 0;
  flex-basis: 100%;
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

.badge-in {
  background: color-mix(in srgb, var(--kapa-positive) 20%, transparent);
  color: var(--kapa-positive);
}

.badge-out {
  background: color-mix(in srgb, var(--kapa-negative) 20%, transparent);
  color: var(--kapa-negative);
}

.amount-in {
  color: var(--kapa-positive);
}

.amount-out {
  color: var(--kapa-negative);
}

.section-title {
  margin: var(--kapa-space-6) 0 var(--kapa-space-2);
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
</style>
