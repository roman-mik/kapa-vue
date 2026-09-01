<script setup lang="ts">
import { type Currency, type CurrencyBucket, type FxRate } from '@roman-mik/kapa-core/pocket';
import { type ScheduleCalendar } from '@roman-mik/kapa-core/horizon';
import { computed, ref } from 'vue';
import PlannedSpendForm from '@/components/horizon/PlannedSpendForm.vue';
import RowEditor, { type RowEditorEntry } from '@/components/horizon/RowEditor.vue';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useCategories } from '@/composables/useCategories';
import { useConvertedAmount } from '@/composables/useConvertedAmount';
import { useEntrySheet } from '@/composables/useEntrySheet';
import { OBLIGATION_CATEGORY_LABELS, useObligations } from '@/composables/useObligations';
import { ONE_OFF_CATEGORY_LABELS, useOneOffEvents } from '@/composables/useOneOffEvents';
import { usePlannedSpend } from '@/composables/usePlannedSpend';
import { useToast } from '@/composables/useToast';
import { buildMoneyOutBuckets, type MoneyOutRow } from '@/lib/horizon/moneyOut';
import { formatMoney, formatRate } from '@/lib/money';
import { formatFullDate, formatFullMonth } from '@/lib/date';
import { useSpaceStore } from '@/stores/space';

const props = withDefaults(defineProps<{ isDesktop?: boolean }>(), { isDesktop: false });

const CADENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const space = useSpaceStore();
const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

const {
  obligationsWithMonth,
  convertibles,
  calendar: calendarRaw,
  month,
  loading,
  error,
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

const { spaceCurrencyAmount, fxAsOf, rateFor } = useConvertedAmount(convertibles);
const { spaceCurrencyAmount: oneOffSpaceCurrencyAmount, rateFor: rateForOneOff } =
  useConvertedAmount(oneOffConvertibles);
const { spaceCurrencyAmount: plannedSpendSpaceCurrencyAmount, rateFor: rateForPlannedSpend } =
  useConvertedAmount(plannedSpendConvertibles);

function categoryName(categoryId: string | null): string {
  if (!categoryId) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

const monthLabel = computed(() => (month.value ? formatFullMonth(month.value) : ''));

const fxNote = computed(() => {
  const asOf = fxAsOf();
  if (!asOf) return '';
  return `${monthLabel.value} · converted at rates as of ${formatFullDate(asOf.date)}`;
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

// The merged one list, flattened (kind lives in the glyph + meta, no category
// subheaders — artboards 3/9). The bucket helper still provides the sorting and
// category labels.
const flatRows = computed<MoneyOutRow[]>(() => buckets.value.flatMap((b) => b.rows));

// Kind filter over the flat list: All / Recurring (obligations) / Planned
// (planned spend) / One-off.
type KindFilter = 'all' | 'recurring' | 'planned' | 'oneOff';
const kindFilter = ref<KindFilter>('all');

const KIND_OPTIONS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'planned', label: 'Planned' },
  { key: 'oneOff', label: 'One-off' },
];

const filtered = computed<MoneyOutRow[]>(() => {
  switch (kindFilter.value) {
    case 'recurring':
      return flatRows.value.filter((r) => r.kind === 'obligation');
    case 'planned':
      return flatRows.value.filter((r) => r.kind === 'plannedSpend');
    case 'oneOff':
      return flatRows.value.filter((r) => r.kind === 'oneOff');
    default:
      return flatRows.value;
  }
});

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

function rowRate(row: MoneyOutRow): FxRate | null {
  if (row.kind === 'obligation') {
    return rateFor({
      id: row.id,
      currency: row.currency as Currency,
      amountMinor: row.amountMinor,
    });
  }
  if (row.kind === 'oneOff') {
    const event = oneOffsMap.value.get(row.id);
    if (!event) return null;
    return rateForOneOff({
      id: row.id,
      currency: row.currency as Currency,
      amountMinor: row.amountMinor,
      asOfDate: event.date,
    });
  }
  return rateForPlannedSpend({
    id: row.id,
    currency: row.currency as Currency,
    amountMinor: row.amountMinor,
  });
}

const totalMinor = computed(() => {
  let total = 0;
  for (const row of flatRows.value) {
    const amt = rowSpaceCurrency(row);
    if (amt != null) total += amt;
  }
  return total;
});

// The FX surface for a row, when the row is foreign and ratable: native amount
// plus the snapshot rate (the date is named once in the fx-note above).
// `null` when native or un-ratable.
function rowFxMeta(row: MoneyOutRow): { native: string; rate: string } | null {
  const rate = rowRate(row);
  if (rate === null) return null;
  return {
    native: formatMoney(row.amountMinor, row.currency as Currency),
    rate: formatRate(rate),
  };
}

// Schedule / due meta for a row: an obligation or one-off date (with the
// slipped original struck through), or a cadence label for planned spend.
function rowDue(row: MoneyOutRow): { live: string; original: string | null } {
  if (row.kind === 'plannedSpend') return { live: row.due, original: null };
  if (row.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(row.dueDate)) {
    // Obligation occurrence can carry a shifted original; planned-spend rows
    // use a cadence label. moneyOut rows only carry `dueDate` for dated rows.
    const occ = row.kind === 'obligation' ? obligationMonthsMap.value.get(row.id) : undefined;
    const shifted = occ?.occurrences.find((o) => o.date === row.dueDate);
    if (shifted?.shifted && shifted.originalDate) {
      return { live: formatFullDate(shifted.date), original: formatFullDate(shifted.originalDate) };
    }
    return { live: formatFullDate(row.dueDate), original: null };
  }
  return { live: row.due, original: null };
}

const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const row of flatRows.value) {
    if (row.kind === 'oneOff' && row.direction === 'in') continue;
    if (rowSpaceCurrency(row) === null) {
      const currency = row.currency as Currency;
      totals.set(currency, (totals.get(currency) ?? 0) + row.amountMinor);
    }
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

// By-kind distribution for the desktop right column (artboard 9).
const byKind = computed(() => {
  const recurring = flatRows.value
    .filter((r) => r.kind === 'obligation')
    .reduce((s, r) => s + (rowSpaceCurrency(r) ?? 0), 0);
  const planned = flatRows.value
    .filter((r) => r.kind === 'plannedSpend')
    .reduce((s, r) => s + (rowSpaceCurrency(r) ?? 0), 0);
  const oneOff = flatRows.value
    .filter((r) => r.kind === 'oneOff' && r.direction === 'out')
    .reduce((s, r) => s + (rowSpaceCurrency(r) ?? 0), 0);
  const grand = recurring + planned + oneOff;
  const pct = (v: number) => (grand > 0 ? Math.round((v / grand) * 100) : 0);
  return [
    { label: 'Recurring', amount: recurring, pct: pct(recurring) },
    { label: 'Planned', amount: planned, pct: pct(planned) },
    { label: 'One-off', amount: oneOff, pct: pct(oneOff) },
  ];
});

const toast = useToast();
const entrySheet = useEntrySheet();

// --- Obligation edit state ---
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

// --- One-off edit state ---
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

// --- Planned spend edit state ---
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

function amountTone(row: MoneyOutRow): string {
  if (row.kind === 'oneOff') return row.direction === 'in' ? 'tone-positive' : 'tone-negative';
  return 'tone-negative';
}

function amountPrefix(row: MoneyOutRow): string {
  if (row.kind === 'oneOff') return row.direction === 'in' ? '+' : '−';
  return '−';
}

function amountMinor(row: MoneyOutRow): number {
  return row.amountMinor;
}

function amountText(row: MoneyOutRow): string {
  return formatMoney(amountMinor(row), row.currency as Currency);
}

// Obligations and one-offs get the compact RowEditor; planned spend keeps its
// full form (cadence/cap fields don't fit the compact shape).
function obligationEntry(row: MoneyOutRow): RowEditorEntry | null {
  const initial = obligationMonthsMap.value.get(row.id);
  if (!initial) return null;
  return {
    kind: 'obligation',
    initial,
    calendar: calendar.value,
    update: updateObligation,
    archive: archiveObligation,
  };
}

function oneOffEntry(row: MoneyOutRow): RowEditorEntry | null {
  const initial = oneOffsMap.value.get(row.id);
  if (!initial) return null;
  return { kind: 'oneOff', initial, update: updateOneOff, remove: removeOneOff };
}
</script>

<template>
  <main class="page page--with-rail">
    <div class="page-main">
      <div class="heading-row">
        <div class="heading-left">
          <h1>Money</h1>
          <BaseButton
            v-if="props.isDesktop"
            type="button"
            variant="secondary"
            class="add-trigger"
            @click="entrySheet.open('out')"
          >
            Add
          </BaseButton>
        </div>
        <span class="hero-amount tone-negative">{{ formatMoney(totalMinor, spaceCurrency) }}</span>
      </div>

      <p class="fx-note" v-if="fxNote">{{ fxNote }}</p>

      <div class="kind-filter" role="group" aria-label="Filter by kind">
        <button
          v-for="opt in KIND_OPTIONS"
          :key="opt.key"
          type="button"
          class="seg"
          :class="{ active: kindFilter === opt.key }"
          :aria-pressed="kindFilter === opt.key"
          @click="kindFilter = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>

      <template v-if="loadingInitial">
        <SkeletonBlock height="42px" />
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="error" role="alert" class="error">{{ error }}</p>

      <template v-else>
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
          v-else-if="!filtered.length"
          title="Nothing here"
          message="No events match this filter this month."
        />

        <ul v-else class="list">
          <li v-for="row in filtered" :key="`${row.kind}:${row.id}`" class="row">
            <template
              v-if="
                (row.kind === 'obligation' && editingObligationId === row.id) ||
                (row.kind === 'oneOff' && editingOneOffId === row.id) ||
                (row.kind === 'plannedSpend' && editingPlannedId === row.id)
              "
            >
              <RowEditor
                v-if="row.kind === 'obligation' && obligationEntry(row)"
                class="edit-form"
                :entry="obligationEntry(row)!"
                @saved="onObligationEdited"
                @archived="onObligationArchived"
                @cancelled="onObligationCancelled"
              />
              <RowEditor
                v-else-if="row.kind === 'oneOff' && oneOffEntry(row)"
                class="edit-form"
                :entry="oneOffEntry(row)!"
                @saved="onOneOffEdited"
                @removed="onOneOffRemoved"
                @cancelled="onOneOffCancelled"
              />
              <PlannedSpendForm
                v-else
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

            <button
              v-else
              type="button"
              class="row-main"
              @click="
                row.kind === 'obligation'
                  ? (editingObligationId = row.id)
                  : row.kind === 'oneOff'
                    ? (editingOneOffId = row.id)
                    : (editingPlannedId = row.id)
              "
            >
              <span class="glyph" :class="amountTone(row)">
                <svg width="22" height="22" viewBox="0 0 22 22">
                  <rect
                    v-if="row.kind === 'obligation'"
                    x="4"
                    y="4"
                    width="14"
                    height="14"
                    rx="3"
                  />
                  <polygon v-else-if="row.kind === 'plannedSpend'" :points="`11,17 3,5 19,5`" />
                  <polygon
                    v-else
                    :points="row.direction === 'out' ? `11,4 18,18 4,18` : `11,18 18,4 4,4`"
                  />
                </svg>
              </span>
              <span class="row-info">
                <span class="row-name">{{ row.name }}</span>
                <span class="meta">
                  <span class="badges">
                    <BaseBadge
                      v-if="row.kind === 'oneOff'"
                      :variant="row.direction === 'in' ? 'in' : 'out'"
                    >
                      {{ row.direction === 'in' ? 'In' : 'Out' }}
                    </BaseBadge>
                    <BaseBadge>{{ row.categoryLabel }}</BaseBadge>
                  </span>
                  <span class="schedule">
                    <template v-if="rowDue(row).original">
                      <s>{{ rowDue(row).original }}</s>
                    </template>
                    {{ rowDue(row).live }}
                  </span>
                </span>
              </span>
              <span class="row-total" :class="amountTone(row)">
                <span class="native">{{ amountPrefix(row) }}{{ amountText(row) }}</span>
                <span v-if="rowFxMeta(row)" class="fx">
                  {{ rowFxMeta(row)!.native }} @ {{ rowFxMeta(row)!.rate }}
                </span>
              </span>
            </button>
          </li>
        </ul>
      </template>
    </div>

    <aside v-if="props.isDesktop" class="page-side">
      <BaseCard class="side-card">
        <h2 class="side-heading">Leaving in {{ monthLabel }}</h2>
        <p class="side-total tone-negative">{{ formatMoney(totalMinor, spaceCurrency) }}</p>
        <UnconvertedNote
          :buckets="unconvertibleBuckets"
          :currency="spaceCurrency"
          context="in this month\u2019s obligations"
        />
      </BaseCard>

      <BaseCard class="side-card">
        <h2 class="side-heading">By kind</h2>
        <div v-for="slice in byKind" :key="slice.label" class="kind-row">
          <span class="kind-label">{{ slice.label }}</span>
          <span class="kind-bar"><span class="fill" :style="{ width: slice.pct + '%' }" /></span>
          <span class="kind-amount">{{ formatMoney(slice.amount, spaceCurrency) }}</span>
        </div>
      </BaseCard>
    </aside>
  </main>
</template>

<style scoped>
.heading-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  margin-bottom: var(--kapa-space-2);
}

.heading-row h1 {
  margin: 0;
}

.heading-left {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-3);
}

.hero-amount {
  font-family: var(--font-heading);
  font-size: 24px;
  color: var(--kapa-ink);
}

.tone-positive {
  color: var(--kapa-positive);
}

.tone-negative {
  color: var(--kapa-negative);
}

.fx-note {
  margin: 0 0 var(--kapa-space-4);
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.kind-filter {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--kapa-space-5);
  background: var(--kapa-neutral-200);
  border-radius: 999px;
}

.seg {
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kapa-ink-muted);
  background: transparent;
  border: 0;
  border-radius: 999px;
  min-height: 44px;
  cursor: pointer;
  transition:
    color var(--kapa-motion-fast) var(--kapa-motion-ease),
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    box-shadow var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.seg.active {
  color: var(--kapa-ink);
  font-weight: 700;
  background: var(--kapa-surface);
  box-shadow: 0 1px 3px rgba(46, 43, 37, 0.14);
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
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: 18px;
}

.row.editing {
  border-color: transparent;
  background: transparent;
}

.row-main {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: var(--kapa-space-3);
  align-items: center;
  width: 100%;
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: none;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 18px;
}

.row-main:focus-visible {
  outline: 2px solid var(--kapa-accent);
  outline-offset: -2px;
}

.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
}

.glyph svg {
  fill: currentColor;
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

.meta {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-1);
}

.schedule {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.schedule s {
  margin-right: 0.35em;
  color: var(--kapa-ink-muted);
}

.row-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-weight: 600;
  text-align: right;
}

.fx {
  font-size: var(--kapa-text-caption-size);
  font-weight: 400;
  color: var(--kapa-ink-muted);
}

.edit-form {
  margin: 0;
}

.side-card {
  padding: var(--kapa-space-4);
}

.side-heading {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--kapa-ink-muted);
  margin: 0 0 var(--kapa-space-2);
}

.side-total {
  font-family: var(--font-heading);
  font-size: 28px;
  margin: 0 0 var(--kapa-space-2);
}

.kind-row {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
  font-size: 13px;
}

.kind-label {
  width: 68px;
  color: var(--kapa-ink-muted);
}

.kind-bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: var(--kapa-neutral-200);
  overflow: hidden;
}

.kind-bar .fill {
  display: block;
  height: 100%;
  background: var(--kapa-accent);
}

.kind-amount {
  min-width: 76px;
  text-align: right;
  font-weight: 600;
  color: var(--kapa-ink);
}
</style>
