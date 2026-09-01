<script setup lang="ts">
import type { Currency } from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import type { SwatchSlot } from '@roman-mik/kapa-core/theme';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import CapProgressCard from '@/components/pocket/CapProgressCard.vue';
import DailySpendChart from '@/components/pocket/DailySpendChart.vue';
import ExpenseRowMenu from '@/components/pocket/ExpenseRowMenu.vue';
import type { RowMenuAction } from '@/components/pocket/expenseRowMenu';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import { usePocketHome } from '@/composables/usePocketHome';
import { useConvertedExpenses } from '@/composables/useConvertedExpenses';
import { useCategories } from '@/composables/useCategories';
import { useExpenses } from '@/composables/useExpenses';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { swatchCssVar } from '@/lib/swatch';

const { summary, loading, error, rates, refresh } = usePocketHome();
const { categories } = useCategories({ includeArchived: true });
const todayExpenses = computed(() => summary.value?.todayExpenses ?? []);
const { isForeign, convertedMinor } = useConvertedExpenses(todayExpenses, rates);
const router = useRouter();
const toast = useToast();
const { duplicate, remove } = useExpenses();

function categoryName(categoryId: string | null): string {
  if (categoryId === null) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

function categorySwatch(categoryId: string | null, position: number): string {
  const color = categories.value.find((c) => c.id === categoryId)?.color ?? null;
  if (color) return swatchCssVar(color as SwatchSlot);
  return `var(--kapa-swatch-${(position % 8) + 1})`;
}

// Cap total isn't a dedicated PocketSummary field — recovered from
// `remaining = cap - spent` the same way CapProgressCard does, only needed
// here for the by-category bars' proportional-share-of-cap denominator.
const capMinor = computed(() =>
  summary.value ? summary.value.spent + summary.value.remaining : 0
);

function categorySharePct(spent: number): number {
  return capMinor.value > 0 ? Math.min((spent / capMinor.value) * 100, 100) : 0;
}

const rowMenuActions: RowMenuAction[] = [
  { id: 'edit', label: 'Edit', kind: 'action' },
  { id: 'duplicate', label: 'Duplicate', kind: 'action' },
  { id: 'delete', label: 'Delete', kind: 'confirm', confirmLabel: 'Really delete?' },
];

function onRowMenuSelect(row: ExpenseView, id: string): void {
  if (id === 'edit') {
    router.push({ name: 'pocket-edit', params: { id: row.id } });
  } else if (id === 'duplicate') {
    void onDuplicate(row);
  }
}

function onRowMenuConfirm(row: ExpenseView, id: string): void {
  if (id === 'delete') void onDelete(row);
}

async function onDuplicate(row: ExpenseView): Promise<void> {
  try {
    await duplicate(row);
    toast.success('Expense duplicated');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't duplicate that expense.");
  }
  await refresh();
}

async function onDelete(row: ExpenseView): Promise<void> {
  try {
    const outcome = await remove(row.id!, row.updated_at ?? '');
    if (!outcome.ok) {
      toast.error('This expense was already changed or deleted elsewhere.');
    } else {
      toast.success('Expense deleted');
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't delete that expense.");
  }
  await refresh();
}
</script>

<template>
  <main class="page page--with-rail">
    <template v-if="loading && !summary">
      <div class="full-row">
        <SkeletonBlock height="160px" radius="md" />
        <SkeletonBlock height="80px" radius="md" />
      </div>
    </template>

    <p v-else-if="error" role="alert" class="error full-row">{{ error }}</p>

    <template v-else-if="summary">
      <div class="page-main">
        <BaseCard v-if="summary.home.kind === 'no-cap'">
          <EmptyState
            title="No cap set yet"
            message="Set a monthly cap to start tracking your spending against it."
          >
            <router-link to="/pocket/cap"><BaseButton>Set a cap</BaseButton></router-link>
          </EmptyState>
        </BaseCard>

        <CapProgressCard v-else :summary="summary" />

        <BaseCard v-if="summary.home.kind !== 'no-cap'" padding="sm">
          <h2>Daily spending</h2>
          <DailySpendChart
            :days="summary.dailyTotals"
            :reference-line="summary.dailyCapReference"
            :currency="summary.currency"
          />
        </BaseCard>
      </div>

      <aside class="page-side">
        <BaseCard v-if="summary.unconverted.length" padding="sm">
          <UnconvertedNote
            :buckets="summary.unconverted"
            :currency="summary.currency"
            context="above"
          />
        </BaseCard>

        <BaseCard padding="sm">
          <div class="today-heading">
            <h2>Today</h2>
            <span v-if="summary.todayExpenses.length" class="today-total money-amount">
              {{ summary.todayExpenses.length }} ·
              {{
                formatMoney(
                  summary.todayExpenses.reduce((sum, r) => sum + (r.amount_minor ?? 0), 0),
                  summary.currency
                )
              }}
            </span>
          </div>
          <EmptyState v-if="!summary.todayExpenses.length" title="No expenses yet today" />
          <ul v-else class="today-list">
            <li v-for="(row, index) in summary.todayExpenses" :key="row.id ?? ''">
              <div class="row-head">
                <div class="main">
                  <span
                    class="dot"
                    :style="{ background: categorySwatch(row.category_id, index) }"
                  />
                  <span class="category">{{ categoryName(row.category_id) }}</span>
                  <span class="amounts">
                    <span class="money-amount">{{
                      formatMoney(
                        row.amount_minor ?? 0,
                        (row.currency ?? summary.currency) as Currency
                      )
                    }}</span>
                    <span v-if="convertedMinor(row) !== null" class="converted">
                      ≈ {{ formatMoney(convertedMinor(row)!, summary.currency) }}
                    </span>
                    <span
                      v-else-if="isForeign(row)"
                      class="unconvertible"
                      title="No fx rate for this pair"
                    >
                      no fx rate
                    </span>
                  </span>
                </div>
                <ExpenseRowMenu
                  :actions="rowMenuActions"
                  :trigger-label="`Actions for ${formatMoney(row.amount_minor ?? 0, (row.currency ?? summary.currency) as Currency)}`"
                  @select="onRowMenuSelect(row, $event)"
                  @confirm="onRowMenuConfirm(row, $event)"
                />
              </div>
            </li>
          </ul>
        </BaseCard>

        <BaseCard v-if="summary.categoryBreakdown.length" padding="sm">
          <h2>By category</h2>
          <ul class="breakdown">
            <li v-for="row in summary.categoryBreakdown" :key="row.categoryId ?? 'none'">
              <div class="breakdown-row-head">
                <span>{{ categoryName(row.categoryId) }}</span>
                <span class="money-amount">{{ formatMoney(row.spent, summary.currency) }}</span>
              </div>
              <div class="mini-bar">
                <div class="mini-bar-fill" :style="{ width: `${categorySharePct(row.spent)}%` }" />
              </div>
            </li>
          </ul>
        </BaseCard>
      </aside>
    </template>
  </main>
</template>

<style scoped>
.page-main {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.page-side {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

/* Loading/error states render as direct grid children of .page--with-rail
 * before .page-main/.page-side exist — span both columns instead of being
 * squeezed into a single narrow one. */
.full-row {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.today-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--kapa-space-2);
  margin-bottom: var(--kapa-space-2);
}

.today-total {
  font-size: var(--kapa-text-caption-size);
}

.breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.breakdown-row-head {
  display: flex;
  justify-content: space-between;
  font-size: var(--kapa-text-caption-size);
}

.mini-bar {
  margin-top: var(--kapa-space-1);
  height: 6px;
  border-radius: 999px;
  background: var(--kapa-neutral-300);
  overflow: hidden;
}

.mini-bar-fill {
  height: 100%;
  border-radius: inherit;
  background: var(--kapa-accent);
}

.today-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-2);
}

.main {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
  font-size: var(--kapa-text-caption-size);
  min-width: 0;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category {
  color: var(--kapa-ink-muted);
}

.amounts {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-2);
  margin-left: auto;
}

.converted {
  color: var(--kapa-ink-muted);
}

.unconvertible {
  color: var(--kapa-negative);
}

.error {
  color: var(--kapa-negative);
}
</style>
