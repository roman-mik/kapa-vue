<script setup lang="ts">
import {
  attributionLabel,
  type Currency,
  dayLabel,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useCategories } from '@/composables/useCategories';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useSpaceMembers } from '@/composables/useSpaceMembers';
import { useToast } from '@/composables/useToast';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { formatMoney } from '@/lib/money';

const { expenses, loading, error, remove } = useExpenses();
const { members } = useSpaceMembers();
const { categories } = useCategories({ includeArchived: true });
const { summary, refresh: refreshSummary } = usePocketHome();
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

const isEmptyBecauseFiltered = computed(
  () => categoryFilter.value !== 'all' && expenses.value.length > 0 && rows.value.length === 0
);

function categoryName(categoryId: string | null): string {
  if (categoryId === null) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
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
      swatch: `var(--kapa-swatch-${(i % 8) + 1})`,
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
  busyId.value = id;
  rowError.value = null;
  try {
    await remove(id);
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
  total: number | null;
  currency: Currency | null;
}

// 'YYYY-MM-DD' parsed and reformatted via an explicit UTC anchor — the key
// is a calendar date with no attached timezone, so letting the browser's
// local zone interpret it could shift the displayed day.
function formatDateHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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

  const now = new Date();
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dateKey, dayRows]) => {
      const label = dayLabel(dateKey, now, timeZone);
      const currencies = new Set(dayRows.map((r) => (r.currency ?? 'RSD') as Currency));
      const singleCurrency = currencies.size === 1 ? [...currencies][0] : null;
      return {
        dateKey,
        heading:
          label === 'today'
            ? 'Today'
            : label === 'yesterday'
              ? 'Yesterday'
              : formatDateHeading(dateKey),
        rows: dayRows,
        currency: singleCurrency,
        total: singleCurrency ? dayRows.reduce((sum, r) => sum + (r.amount_minor ?? 0), 0) : null,
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
      <p v-if="summary!.unconverted.length" class="breakdown-note">
        {{
          summary!.unconverted
            .map((bucket) => formatMoney(bucket.amountMinor, bucket.currency))
            .join(' + ')
        }}
        couldn't be converted to {{ summary!.currency }} and
        {{ summary!.unconverted.length === 1 ? "isn't" : "aren't" }} included in this breakdown.
      </p>
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
        {{ c.name }}
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
          <span v-if="group.total !== null && group.currency" class="day-total">
            {{ formatMoney(group.total, group.currency) }}
          </span>
        </div>

        <ul class="list">
          <li v-for="row in group.rows" :key="row.id ?? ''">
            <div class="main">
              <span class="amount">{{
                formatMoney(row.amount_minor ?? 0, (row.currency ?? 'RSD') as Currency)
              }}</span>
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
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-negative);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
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
