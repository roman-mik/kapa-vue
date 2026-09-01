<script setup lang="ts">
import {
  attributionLabel,
  type Currency,
  type CurrencyBucket,
  dayLabel,
  dayTotals,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import { useCategories } from '@/composables/useCategories';
import { useConvertedExpenses } from '@/composables/useConvertedExpenses';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useSpaceMembers } from '@/composables/useSpaceMembers';
import { useToast } from '@/composables/useToast';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
import { swatchCssVar } from '@/lib/swatch';
import { toExpenseAmount } from '@/lib/expenseAmount';
import type { SwatchSlot } from '@roman-mik/kapa-core/theme';

const { expenses, loading, error, remove } = useExpenses();
const {
  summary,
  refresh: refreshSummary,
  rates,
  loading: ratesLoading,
  error: ratesError,
} = usePocketHome();
const { spaceCurrency, isForeign, convertedMinor, unconvertible } = useConvertedExpenses(
  expenses,
  rates
);
const { members } = useSpaceMembers();
const { categories } = useCategories({ includeArchived: true });
const space = useSpaceStore();
const toast = useToast();
const session = useSessionStore();

const busyId = ref<string | null>(null);
const rowError = ref<string | null>(null);

// 'all' shows everything; '' is the uncategorized bucket; anything else is a
// category id. The month breakdown bar below is intentionally unaffected by
// this filter — it always reflects the whole month, per the plan.
const categoryFilter = ref<string>('all');

// A filter belonging to the previous space must not linger and silently empty
// the list after a space switch.
watch(
  () => space.currentSpaceId,
  () => {
    categoryFilter.value = 'all';
  }
);

// Grouped the same way summary.unconverted is (by currency, summed) so
// HistoryView and PocketHomeView can render the identical UnconvertedNote.
const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const row of unconvertible.value) {
    const currency = (row.currency ?? 'RSD') as Currency;
    totals.set(currency, (totals.get(currency) ?? 0) + (row.amount_minor ?? 0));
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

const isEmptyBecauseFiltered = computed(
  () => categoryFilter.value !== 'all' && expenses.value.length > 0 && rows.value.length === 0
);

function categoryName(categoryId: string | null): string {
  if (categoryId === null) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

// A category's own swatch slot when it has one; uncategorized (or a category
// without a colour) falls back to the position-based slot so the bar stays
// readable. Slots are theme-agnostic names rendered through the generated
// `--kapa-swatch-*` vars.
function categorySwatch(categoryId: string | null, position: number): string {
  const color = categories.value.find((c) => c.id === categoryId)?.color ?? null;
  if (color) return swatchCssVar(color as SwatchSlot);
  return `var(--kapa-swatch-${(position % 8) + 1})`;
}

const breakdown = computed(() => {
  const rowsIn = summary.value?.categoryBreakdown ?? [];
  const total = rowsIn.reduce((sum, r) => sum + r.spent, 0);
  if (total <= 0) return [];
  return rowsIn
    .filter((r) => r.spent > 0)
    .map((r, i) => ({
      categoryId: r.categoryId,
      name: categoryName(r.categoryId),
      spent: r.spent,
      pct: (r.spent / total) * 100,
      swatch: categorySwatch(r.categoryId, i),
    }))
    .sort((a, b) => b.spent - a.spent);
});

function attribution(userId: string | null): string {
  const currentUserId = session.user?.id ?? '';
  const member = members.value.find((m) => m.userId === userId);
  return attributionLabel(
    userId,
    currentUserId,
    member ? { displayName: member.displayName } : undefined,
    {
      you: 'You',
      spaceMember: 'Space member',
      formerMember: 'Former member',
    }
  );
}

async function onDelete(id: string): Promise<void> {
  // Delete is scoped to the row's `updated_at` as this list last read it; a
  // conflict means another member changed or removed it first. useExpenses
  // already refreshed the list either way — only the message differs.
  const expectedUpdatedAt = expenses.value.find((e) => e.id === id)?.updated_at ?? '';
  busyId.value = id;
  rowError.value = null;
  try {
    const outcome = await remove(id, expectedUpdatedAt);
    if (!outcome.ok) {
      rowError.value =
        'This expense was already changed or deleted elsewhere. The list is refreshed.';
      toast.error(rowError.value);
      return;
    }
    toast.success('Expense deleted');
  } catch (err) {
    rowError.value = err instanceof Error ? err.message : "Couldn't delete that expense.";
    toast.error(rowError.value);
  } finally {
    busyId.value = null;
  }
  // Refresh the breakdown bar separately: a refresh failure after a
  // successful delete is not a delete failure, so it must not surface as
  // "Couldn't delete that expense.".
  try {
    await refreshSummary();
  } catch {
    // ignore — stale summary is better than a misleading delete error
  }
}

const rows = computed(() => {
  if (categoryFilter.value === 'all') return expenses.value;
  const wantsUncategorized = categoryFilter.value === '';
  return expenses.value.filter((e) =>
    wantsUncategorized ? e.category_id === null : e.category_id === categoryFilter.value
  );
});

interface DayGroup {
  dateKey: string;
  heading: string;
  rows: ExpenseView[];
  total: number;
  currency: Currency;
  unconverted: CurrencyBucket[];
}

const dayGroups = computed<DayGroup[]>(() => {
  const timeZone = space.currentSpace?.timezone;
  if (!timeZone) return [];

  const byDay = new Map<string, ExpenseView[]>();
  for (const row of rows.value) {
    if (!row.spent_at) continue;
    const dateKey = zonedDateKey(new Date(row.spent_at), timeZone);
    (byDay.get(dateKey) ?? byDay.set(dateKey, []).get(dateKey)!).push(row);
  }

  // Day totals trace to kapa-core's own aggregation, same rule as
  // usePocketHome — a day with an unconvertible row shows the convertible
  // part's total, and its own `unconverted` bucket explains what's missing.
  const totals = dayTotals(
    rows.value.map(toExpenseAmount),
    timeZone,
    spaceCurrency.value,
    rates.value
  );
  const totalsByDay = new Map(totals.value.map((t) => [t.dateKey, t]));

  const now = new Date();
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dateKey, dayRows]) => {
      const label = dayLabel(dateKey, now, timeZone);
      const dayTotal = totalsByDay.get(dateKey);
      return {
        dateKey,
        heading:
          label === 'today'
            ? 'Today'
            : label === 'yesterday'
              ? 'Yesterday'
              : formatFullDate(dateKey),
        rows: dayRows,
        currency: spaceCurrency.value,
        total: dayTotal?.amountMinor ?? 0,
        unconverted: dayTotal?.unconverted ?? [],
      };
    });
});
</script>

<template>
  <main class="page">
    <h1>History</h1>

    <div v-if="breakdown.length" class="breakdown">
      <div
        class="breakdown-bar"
        role="img"
        :aria-label="`Month breakdown: ${breakdown.map((b) => `${b.name} ${formatMoney(b.spent, summary!.currency)}`).join(', ')}`"
      >
        <span
          v-for="b in breakdown"
          :key="b.categoryId ?? 'uncategorized'"
          class="breakdown-segment"
          :style="{ width: `${b.pct}%`, background: b.swatch }"
        />
      </div>
      <ul class="breakdown-legend">
        <li v-for="b in breakdown" :key="b.categoryId ?? 'uncategorized'">
          <span class="dot" :style="{ background: b.swatch }" />
          <span class="name">{{ b.name }}</span>
          <span class="amount">{{ formatMoney(b.spent, summary!.currency) }}</span>
        </li>
      </ul>
      <UnconvertedNote
        class="breakdown-note"
        :buckets="summary!.unconverted"
        :currency="summary!.currency"
        context="in this breakdown"
      />
    </div>

    <div class="chips" role="radiogroup" aria-label="Filter by category">
      <BaseButton
        type="button"
        role="radio"
        :aria-checked="categoryFilter === 'all'"
        :variant="categoryFilter === 'all' ? 'primary' : 'secondary'"
        @click="categoryFilter = 'all'"
      >
        All
      </BaseButton>
      <BaseButton
        type="button"
        role="radio"
        :aria-checked="categoryFilter === ''"
        :variant="categoryFilter === '' ? 'primary' : 'secondary'"
        @click="categoryFilter = ''"
      >
        Uncategorized
      </BaseButton>
      <BaseButton
        v-for="c in categories"
        :key="c.id"
        type="button"
        role="radio"
        :aria-checked="categoryFilter === c.id"
        :variant="categoryFilter === c.id ? 'primary' : 'secondary'"
        @click="categoryFilter = c.id"
      >
        <span class="chip-inner">
          <span
            class="dot chip-dot"
            :style="c.color ? { background: swatchCssVar(c.color as SwatchSlot) } : undefined"
            :class="{ 'chip-dot--empty': !c.color }"
          />
          {{ c.name }}
        </span>
      </BaseButton>
    </div>

    <template v-if="loading && !rows.length">
      <SkeletonBlock height="64px" />
      <SkeletonBlock height="64px" />
      <SkeletonBlock height="64px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>
    <EmptyState
      v-else-if="!rows.length"
      :title="isEmptyBecauseFiltered ? 'No expenses match this category' : 'No expenses yet'"
    />

    <template v-else>
      <section v-for="group in dayGroups" :key="group.dateKey" class="day-group">
        <div class="day-heading">
          <h2>{{ group.heading }}</h2>
          <span class="day-total">{{ formatMoney(group.total, group.currency) }}</span>
        </div>
        <UnconvertedNote
          v-if="group.unconverted.length"
          class="day-unconverted-note"
          :buckets="group.unconverted"
          :currency="group.currency"
          context="in this day's total"
        />

        <ul class="list">
          <li v-for="row in group.rows" :key="row.id ?? ''">
            <div class="main">
              <span class="amount">{{
                formatMoney(row.amount_minor ?? 0, (row.currency ?? 'RSD') as Currency)
              }}</span>
              <span v-if="convertedMinor(row) !== null" class="converted">
                ≈ {{ formatMoney(convertedMinor(row)!, spaceCurrency) }}
              </span>
              <span v-else-if="ratesError" class="unconvertible" :title="ratesError">
                rates unavailable
              </span>
              <span
                v-else-if="!ratesLoading && isForeign(row)"
                class="unconvertible"
                title="No fx rate for this pair"
              >
                no fx rate
              </span>
              <span class="category">{{ row.category_name ?? 'Uncategorized' }}</span>
              <span class="attribution">{{ attribution(row.user_id) }}</span>
            </div>
            <p v-if="row.note" class="note">{{ row.note }}</p>
            <div class="actions">
              <router-link :to="{ name: 'pocket-edit', params: { id: row.id } }">
                <BaseButton variant="ghost">Edit</BaseButton>
              </router-link>
              <ConfirmButton
                label="Delete"
                confirm-label="Really delete?"
                :disabled="busyId === row.id"
                @confirm="onDelete(row.id!)"
              />
            </div>
          </li>
        </ul>
      </section>
    </template>
    <p v-if="rowError" role="alert" class="error">{{ rowError }}</p>
    <p v-else-if="ratesError" role="alert" class="error">{{ ratesError }}</p>
    <UnconvertedNote
      v-else
      class="unconverted-note"
      :buckets="unconvertibleBuckets"
      :currency="spaceCurrency"
      context="in this list"
    />
  </main>
</template>

<style scoped>
.breakdown {
  margin-bottom: var(--kapa-space-4);
}

.breakdown-bar {
  display: flex;
  width: 100%;
  height: var(--kapa-space-2);
  border-radius: var(--kapa-radius-sm);
  overflow: hidden;
  background: var(--kapa-neutral-200);
}

.breakdown-segment {
  height: 100%;
}

.breakdown-legend {
  list-style: none;
  margin: var(--kapa-space-2) 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-1) var(--kapa-space-3);
}

.breakdown-legend li {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-1);
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.breakdown-note {
  margin: var(--kapa-space-2) 0 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--kapa-space-1);
}

.chip-dot--empty {
  border: 1px dashed currentColor;
}

.amount {
  color: var(--kapa-ink-subtle);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
  margin-bottom: var(--kapa-space-4);
}

.day-group + .day-group {
  margin-top: var(--kapa-space-5);
}

.day-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--kapa-space-2);
}

.day-heading h2 {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.day-total {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.list li {
  padding: var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
}

.main {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-2);
}

.amount {
  font-weight: 600;
}

.converted {
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.unconvertible {
  color: var(--kapa-negative);
  font-size: var(--kapa-text-caption-size);
}

.unconverted-note {
  margin-top: var(--kapa-space-3);
}

.day-unconverted-note {
  margin-bottom: var(--kapa-space-2);
}

.category {
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.attribution {
  margin-left: auto;
  color: var(--kapa-ink-subtle);
  font-size: var(--kapa-text-caption-size);
}

.note {
  margin: var(--kapa-space-1) 0 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.actions {
  display: flex;
  gap: var(--kapa-space-2);
  margin-top: var(--kapa-space-2);
}

.error {
  color: var(--kapa-negative);
}
</style>
