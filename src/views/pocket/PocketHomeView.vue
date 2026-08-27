<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import ProgressBar from '@/components/ui/ProgressBar.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import DailySpendChart from '@/components/pocket/DailySpendChart.vue';
import { usePocketHome } from '@/composables/usePocketHome';
import { useCategories } from '@/composables/useCategories';
import { formatMoney } from '@/lib/money';

const { summary, loading, error } = usePocketHome();
const { categories } = useCategories({ includeArchived: true });

function categoryName(categoryId: string | null): string {
  if (categoryId === null) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

const barPct = computed(() => summary.value?.spentPct ?? 0);

const barState = computed<'healthy' | 'nudge' | 'over'>(() => {
  const home = summary.value?.home;
  if (!home || home.kind === 'no-cap') return 'healthy';
  if (home.kind === 'over') return 'over';
  return home.nudge ? 'nudge' : 'healthy';
});
</script>

<template>
  <main class="page home">
    <template v-if="loading && !summary">
      <SkeletonBlock height="160px" radius="md" />
      <SkeletonBlock height="80px" radius="md" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else-if="summary">
      <BaseCard v-if="summary.home.kind === 'no-cap'">
        <EmptyState
          title="No cap set yet"
          message="Set a monthly cap to start tracking your spending against it."
        >
          <router-link to="/pocket/cap"><BaseButton>Set a cap</BaseButton></router-link>
        </EmptyState>
      </BaseCard>

      <BaseCard v-else class="summary-card">
        <StatBlock
          :value="formatMoney(summary.spent, summary.currency)"
          label="spent this month"
          :tone="summary.home.kind === 'over' ? 'negative' : 'default'"
        />

        <ProgressBar :percent="barPct" :state="barState" />

        <p v-if="summary.home.kind === 'over'" class="line negative">
          {{ formatMoney(summary.overspend, summary.currency) }} over your cap.
        </p>
        <p v-else class="line">
          {{ formatMoney(summary.remaining, summary.currency) }} left this month.
        </p>

        <p
          v-if="summary.home.kind === 'over' && summary.home.recovery.suggested"
          class="line muted"
        >
          To even out, consider next month's cap at
          {{ formatMoney(summary.home.recovery.cap, summary.currency) }}.
        </p>

        <p v-if="summary.home.kind === 'in-budget' && summary.home.nudge" class="line negative">
          You're approaching your cap — {{ formatMoney(summary.safeDaily, summary.currency) }}/day
          left for the rest of the month.
        </p>
        <p v-else-if="summary.home.kind === 'in-budget'" class="line muted">
          Safe to spend {{ formatMoney(summary.safeDaily, summary.currency) }}/day for the rest of
          the month.
        </p>

        <p v-if="summary.home.kind === 'in-budget' && summary.home.showPace" class="line muted">
          <template v-if="summary.paceGap >= 0">
            {{ formatMoney(summary.paceGap, summary.currency) }} under an even pace.
          </template>
          <template v-else>
            {{ formatMoney(-summary.paceGap, summary.currency) }} over an even pace.
          </template>
        </p>

        <p
          v-if="summary.home.kind === 'in-budget' && summary.home.showProjection"
          class="line muted"
        >
          Projected to land at {{ formatMoney(summary.projection, summary.currency) }} by month end.
        </p>
      </BaseCard>

      <BaseCard v-if="summary.home.kind !== 'no-cap'" padding="sm">
        <h2>Daily spending</h2>
        <DailySpendChart
          :days="summary.dailyTotals"
          :reference-line="summary.dailyCapReference"
          :currency="summary.currency"
        />
      </BaseCard>

      <BaseCard v-if="summary.categoryBreakdown.length" padding="sm">
        <h2>By category</h2>
        <ul class="breakdown">
          <li v-for="row in summary.categoryBreakdown" :key="row.categoryId ?? 'none'">
            <span>{{ categoryName(row.categoryId) }}</span>
            <span>{{ formatMoney(row.spent, summary.currency) }}</span>
          </li>
        </ul>
      </BaseCard>
    </template>
  </main>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.summary-card {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.line {
  margin: 0;
  color: var(--kapa-ink);
}

.line.muted {
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.line.negative {
  color: var(--kapa-negative);
  font-weight: 600;
}

.breakdown {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.breakdown li {
  display: flex;
  justify-content: space-between;
  font-size: var(--kapa-text-caption-size);
}

.error {
  color: var(--kapa-negative);
}
</style>
