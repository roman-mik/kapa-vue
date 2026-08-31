<script setup lang="ts">
import { type Currency, type CurrencyBucket, zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { type ScheduleCalendar } from '@roman-mik/kapa-core/horizon';
import { computed, ref } from 'vue';
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
import { OBLIGATION_CATEGORY_LABELS, useObligations } from '@/composables/useObligations';
import { ONE_OFF_CATEGORY_LABELS, useOneOffEvents } from '@/composables/useOneOffEvents';
import { usePlannedSpend } from '@/composables/usePlannedSpend';
import { useToast } from '@/composables/useToast';
import { buildMoneyOutBuckets, type MoneyOutRow } from '@/lib/horizon/moneyOut';
import { formatMoney } from '@/lib/money';
import { useSpaceStore } from '@/stores/space';

const CADENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

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

const space = useSpaceStore();
const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

const {
  obligationsWithMonth,
  convertibles,
  calendar: calendarRaw,
  month,
  loading,
  error,
  add,
  update: updateObligation,
  archive: archiveObligation,
} = useObligations();
const calendar = computed<ScheduleCalendar>(
  () => calendarRaw.value ?? { workingWeekdays: [1, 2, 3, 4, 5], holidays: [] }
);

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
  update: updatePlannedSpend,
  archive: archivePlannedSpend,
} = usePlannedSpend();
const { accounts } = useAccounts();
const { categories } = useCategories();

const { convertedMinor, spaceCurrencyAmount } = useConvertedAmount(convertibles);
const { convertedMinor: convertedOneOffMinor, spaceCurrencyAmount: oneOffSpaceCurrencyAmount } =
  useConvertedAmount(oneOffConvertibles);
const {
  convertedMinor: convertedPlannedSpendMinor,
  spaceCurrencyAmount: plannedSpendSpaceCurrencyAmount,
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

const obligationMonthsMap = computed(() => {
  const map = new Map<string, (typeof obligationsWithMonth.value)[number]>();
  for (const o of obligationsWithMonth.value) map.set(o.id, o);
  return map;
});

const oneOffsMap = computed(() => {
  const map = new Map<string, (typeof monthOneOffs.value)[number]>();
  for (const e of monthOneOffs.value) map.set(e.id, e);
  return map;
});

const plannedSpendMap = computed(() => {
  const map = new Map<string, (typeof plannedSpendWithMonth.value)[number]>();
  for (const item of plannedSpendWithMonth.value) map.set(item.id, item);
  return map;
});

const buckets = computed(() =>
  buildMoneyOutBuckets(
    {
      obligations: obligationsWithMonth.value.map((o) => ({
        id: o.id,
        name: o.name,
        category: o.category,
        currency: o.currency,
        monthlyMinor: o.monthlyMinor,
        firstDueDate: o.occurrences[0]?.date ?? null,
      })),
      oneOffs: monthOneOffs.value.map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        currency: e.currency,
        amountMinor: e.amount_minor,
        date: e.date,
        direction: e.direction as 'in' | 'out',
      })),
      plannedSpend: plannedSpendWithMonth.value.map((item) => ({
        id: item.id,
        name: item.name,
        categoryId: item.category_id,
        currency: item.currency,
        monthlyMinor: item.monthlyMinor,
        chargeCadence: item.charge_cadence,
      })),
    },
    {
      spendCategory: { ...OBLIGATION_CATEGORY_LABELS, ...ONE_OFF_CATEGORY_LABELS },
      cadence: CADENCE_LABELS,
      pocketCategory: categoryName,
    }
  )
);

function rowSpaceCurrency(row: MoneyOutRow): number | null {
  if (row.kind === 'obligation') {
    return spaceCurrencyAmount({
      id: row.id,
      currency: row.currency as Currency,
      amountMinor: row.amountMinor,
    });
  }
  if (row.kind === 'oneOff') {
    const event = oneOffsMap.value.get(row.id);
    if (!event || event.direction !== 'out') return null;
    return oneOffSpaceCurrencyAmount({
      id: row.id,
      currency: row.currency as Currency,
      amountMinor: row.amountMinor,
      asOfDate: event.date,
    });
  }
  return plannedSpendSpaceCurrencyAmount({
    id: row.id,
    currency: row.currency as Currency,
    amountMinor: row.amountMinor,
  });
}

function rowConvertedCurrency(row: MoneyOutRow): number | null {
  if (row.kind === 'obligation') {
    return convertedMinor({
      id: row.id,
      currency: row.currency as Currency,
      amountMinor: row.amountMinor,
    });
  }
  if (row.kind === 'oneOff') {
    const event = oneOffsMap.value.get(row.id);
    if (!event) return null;
    return convertedOneOffMinor({
      id: row.id,
      currency: row.currency as Currency,
      amountMinor: row.amountMinor,
      asOfDate: event.date,
    });
  }
  return convertedPlannedSpendMinor({
    id: row.id,
    currency: row.currency as Currency,
    amountMinor: row.amountMinor,
  });
}

const totalMinor = computed(() => {
  let total = 0;
  for (const bucket of buckets.value) {
    for (const row of bucket.rows) {
      const amt = rowSpaceCurrency(row);
      if (amt != null) total += amt;
    }
  }
  return total;
});

function bucketTotal(bucket: (typeof buckets.value)[number]): number {
  let total = 0;
  for (const row of bucket.rows) {
    const amt = rowSpaceCurrency(row);
    if (amt != null) total += amt;
  }
  return total;
}

// Collect unconvertible foreign amounts from all three sub-lists, bucketed by
// currency. Only out-flows count toward the hero total, so only they appear
// here.
const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const bucket of buckets.value) {
    for (const row of bucket.rows) {
      // A one-off in-flow contributes nothing to the total and nothing to the
      // note; skip it entirely.
      if (row.kind === 'oneOff' && row.direction === 'in') continue;
      if (rowSpaceCurrency(row) === null) {
        const currency = row.currency as Currency;
        totals.set(currency, (totals.get(currency) ?? 0) + row.amountMinor);
      }
    }
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

const toast = useToast();

function onSaved(kind: 'obligation' | 'oneOff' | 'planned'): void {
  const label =
    kind === 'obligation' ? 'Obligation' : kind === 'oneOff' ? 'One-off' : 'Planned spend';
  toast.success(`${label} added`);
}

// --- Obligation edit state --------------------------------------------------
const editingObligationId = ref<string | null>(null);

function onObligationEdited(): void {
  editingObligationId.value = null;
  toast.success('Obligation updated');
}

function onObligationArchived(): void {
  editingObligationId.value = null;
  toast.success('Obligation archived');
}

function onObligationCancelled(): void {
  editingObligationId.value = null;
}

// --- One-off edit state -----------------------------------------------------
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

// --- Planned spend edit state ------------------------------------------------
const editingPlannedId = ref<string | null>(null);

function onPlannedEdited(): void {
  editingPlannedId.value = null;
  toast.success('Planned spend updated');
}

function onPlannedArchived(): void {
  editingPlannedId.value = null;
  toast.success('Planned spend archived');
}

function onPlannedCancelled(): void {
  editingPlannedId.value = null;
}

const loadingInitial = computed(() => loading.value && !obligationsWithMonth.value.length);
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

    <template v-if="loadingInitial">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <ObligationForm
        :accounts="accounts.filter((a) => !a.archived)"
        :space-currency="spaceCurrency"
        :default-start-date="month ? `${month}-01` : ''"
        :calendar="calendar"
        :save="add"
        @saved="onSaved('obligation')"
      />

      <OneOffEventForm
        :accounts="accounts.filter((a) => !a.archived)"
        :space-currency="spaceCurrency"
        :default-date="defaultOneOffDate"
        :save="addOneOff"
        @saved="onSaved('oneOff')"
      />

      <PlannedSpendForm
        :accounts="accounts.filter((a) => !a.archived)"
        :categories="categories"
        :space-currency="spaceCurrency"
        :default-start-date="month ? `${month}-01` : ''"
        :save="addPlannedSpend"
        @saved="onSaved('planned')"
      />

      <template
        v-if="
          plannedSpendLoading &&
          !plannedSpendWithMonth.length &&
          !oneOffsLoading &&
          !monthOneOffs.length
        "
      >
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="plannedSpendError" role="alert" class="error">{{ plannedSpendError }}</p>
      <p v-else-if="oneOffsError" role="alert" class="error">{{ oneOffsError }}</p>

      <EmptyState
        v-else-if="!buckets.length"
        title="Nothing owed this month"
        message="Add an obligation, one-off event, or planned spend item above."
      />

      <ul v-else class="list">
        <li v-for="bucket in buckets" :key="bucket.key" class="bucket">
          <div class="bucket-header">
            <span class="bucket-label">{{ bucket.label }}</span>
            <span class="bucket-total">{{ formatMoney(bucketTotal(bucket), spaceCurrency) }}</span>
          </div>

          <ul class="bucket-rows">
            <li
              v-for="row in bucket.rows"
              :key="`${row.kind}:${row.id}`"
              class="row"
              :class="{
                editing:
                  editingObligationId === row.id ||
                  editingOneOffId === row.id ||
                  editingPlannedId === row.id,
              }"
            >
              <!-- Obligation edit -->
              <template v-if="row.kind === 'obligation' && editingObligationId === row.id">
                <ObligationForm
                  class="edit-form"
                  :accounts="accounts.filter((a) => !a.archived)"
                  :space-currency="spaceCurrency"
                  :default-start-date="row.due || month ? `${month}-01` : ''"
                  :calendar="calendar"
                  :initial="obligationMonthsMap.get(row.id) ?? null"
                  :save="add"
                  :update="updateObligation"
                  :archive="archiveObligation"
                  @saved="onObligationEdited"
                  @archived="onObligationArchived"
                  @cancelled="onObligationCancelled"
                />
              </template>

              <!-- One-off edit -->
              <template v-else-if="row.kind === 'oneOff' && editingOneOffId === row.id">
                <OneOffEventForm
                  class="edit-form"
                  :accounts="accounts.filter((a) => !a.archived)"
                  :space-currency="spaceCurrency"
                  :default-date="defaultOneOffDate"
                  :initial="oneOffsMap.get(row.id) ?? null"
                  :save="addOneOff"
                  :update="updateOneOff"
                  :remove="removeOneOff"
                  @saved="onOneOffEdited"
                  @removed="onOneOffRemoved"
                  @cancelled="onOneOffCancelled"
                />
              </template>

              <!-- Planned spend edit -->
              <template v-else-if="row.kind === 'plannedSpend' && editingPlannedId === row.id">
                <PlannedSpendForm
                  class="edit-form"
                  :accounts="accounts.filter((a) => !a.archived)"
                  :categories="categories"
                  :space-currency="spaceCurrency"
                  :default-start-date="month ? `${month}-01` : ''"
                  :initial="plannedSpendMap.get(row.id) ?? null"
                  :save="addPlannedSpend"
                  :update="updatePlannedSpend"
                  :archive="archivePlannedSpend"
                  @saved="onPlannedEdited"
                  @archived="onPlannedArchived"
                  @cancelled="onPlannedCancelled"
                />
              </template>

              <!-- Read-only row -->
              <template v-else>
                <div class="row-info">
                  <span class="row-name">{{ row.name }}</span>
                  <span class="badges">
                    <span
                      v-if="row.kind === 'oneOff'"
                      class="badge"
                      :class="row.direction === 'in' ? 'badge-in' : 'badge-out'"
                    >
                      {{ row.direction === 'in' ? 'In' : 'Out' }}
                    </span>
                    <span class="badge">{{ row.categoryLabel }}</span>
                    <span class="badge">{{ row.due }}</span>
                  </span>
                </div>

                <span class="row-total">
                  <span
                    class="native"
                    :class="{
                      'amount-in': row.kind === 'oneOff' && row.direction === 'in',
                      'amount-out': row.kind === 'oneOff' && row.direction === 'out',
                    }"
                  >
                    {{
                      row.kind === 'oneOff' && row.direction === 'in'
                        ? '+'
                        : row.kind === 'oneOff' && row.direction === 'out'
                          ? '−'
                          : ''
                    }}{{ formatMoney(row.amountMinor, row.currency as Currency) }}
                  </span>
                  <span v-if="rowConvertedCurrency(row) !== null" class="converted">
                    ≈ {{ formatMoney(rowConvertedCurrency(row)!, spaceCurrency) }}
                  </span>
                </span>

                <BaseButton
                  variant="ghost"
                  type="button"
                  class="edit-btn"
                  @click="
                    row.kind === 'obligation'
                      ? (editingObligationId = row.id)
                      : row.kind === 'oneOff'
                        ? (editingOneOffId = row.id)
                        : (editingPlannedId = row.id)
                  "
                >
                  Edit
                </BaseButton>
              </template>
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
  gap: var(--kapa-space-4);
}

.bucket-header {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-3);
  padding-bottom: var(--kapa-space-1);
  border-bottom: 1px solid var(--kapa-neutral-400);
}

.bucket-label {
  font-size: var(--kapa-text-body-size);
  font-weight: 700;
  color: var(--kapa-ink);
}

.bucket-total {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
  margin-left: auto;
}

.bucket-rows {
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
</style>
