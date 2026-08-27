<script setup lang="ts">
import { usePocketHome } from '@/composables/usePocketHome';
import { useCategories } from '@/composables/useCategories';
import { formatMoney } from '@/lib/money';
import { computed } from 'vue';

const { summary, loading, error } = usePocketHome();
const { categories } = useCategories({ includeArchived: true });

function categoryName(categoryId: string | null): string {
  if (categoryId === null) return 'Uncategorized';
  return categories.value.find((c) => c.id === categoryId)?.name ?? 'Uncategorized';
}

const barPct = computed(() => summary.value?.spentPct ?? 0);
</script>

<template>
  <main class="home">
    <p v-if="loading && !summary">Loading…</p>
    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else-if="summary">
      <section v-if="summary.home.kind === 'no-cap'" class="card no-cap">
        <h1>No cap set yet</h1>
        <p>Set a monthly cap to start tracking your spending against it.</p>
        <router-link class="cta" to="/pocket/cap">Set a cap</router-link>
      </section>

      <section v-else class="card">
        <h1>{{ formatMoney(summary.spent, summary.currency) }} spent this month</h1>

        <div
          class="bar"
          role="progressbar"
          :aria-valuenow="barPct"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div
            class="bar-fill"
            :class="{ over: summary.home.kind === 'over' }"
            :style="{ width: `${barPct}%` }"
          />
        </div>

        <p v-if="summary.home.kind === 'over'" class="over-line">
          {{ formatMoney(summary.overspend, summary.currency) }} over your cap.
        </p>
        <p v-else>{{ formatMoney(summary.remaining, summary.currency) }} left this month.</p>

        <p v-if="summary.home.kind === 'over' && summary.home.recovery.suggested" class="recovery">
          To even out, consider next month's cap at
          {{ formatMoney(summary.home.recovery.cap, summary.currency) }}.
        </p>

        <p v-if="summary.home.kind === 'in-budget' && summary.home.nudge" class="nudge">
          You're approaching your cap — {{ formatMoney(summary.safeDaily, summary.currency) }}/day
          left for the rest of the month.
        </p>
        <p v-else-if="summary.home.kind === 'in-budget'">
          Safe to spend {{ formatMoney(summary.safeDaily, summary.currency) }}/day for the rest of
          the month.
        </p>

        <p v-if="summary.home.kind === 'in-budget' && summary.home.showPace" class="pace">
          <template v-if="summary.paceGap >= 0">
            {{ formatMoney(summary.paceGap, summary.currency) }} under an even pace.
          </template>
          <template v-else>
            {{ formatMoney(-summary.paceGap, summary.currency) }} over an even pace.
          </template>
        </p>

        <p
          v-if="summary.home.kind === 'in-budget' && summary.home.showProjection"
          class="projection"
        >
          Projected to land at {{ formatMoney(summary.projection, summary.currency) }} by month end.
        </p>
      </section>

      <section v-if="summary.categoryBreakdown.length" class="card breakdown">
        <h2>By category</h2>
        <ul>
          <li v-for="row in summary.categoryBreakdown" :key="row.categoryId ?? 'none'">
            <span>{{ categoryName(row.categoryId) }}</span>
            <span>{{ formatMoney(row.spent, summary.currency) }}</span>
          </li>
        </ul>
      </section>

      <router-link class="cta add" to="/pocket/add">Add expense</router-link>
    </template>
  </main>
</template>

<style scoped>
.home {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.card {
  background: var(--kapa-surface);
  border-radius: var(--kapa-radius-md);
  padding: 1.5rem;
  box-shadow: var(--kapa-shadow-sm);
}

h1 {
  font-size: 1.25rem;
  margin: 0 0 1rem;
}

h2 {
  font-size: 1rem;
  margin: 0 0 0.75rem;
}

.bar {
  height: 10px;
  border-radius: 999px;
  background: var(--kapa-neutral-300);
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.bar-fill {
  height: 100%;
  background: var(--kapa-accent);
}

.bar-fill.over {
  background: var(--kapa-negative);
}

.over-line {
  color: var(--kapa-negative);
  font-weight: 600;
}

.nudge {
  color: var(--kapa-negative);
}

.recovery,
.pace,
.projection {
  color: var(--kapa-ink-muted);
  font-size: 0.9rem;
}

.breakdown ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.breakdown li {
  display: flex;
  justify-content: space-between;
  font-size: 0.9rem;
}

.cta {
  display: block;
  text-align: center;
  padding: 0.6rem 1rem;
  border-radius: var(--kapa-radius-sm);
  background: var(--kapa-accent);
  color: var(--kapa-white);
  text-decoration: none;
  font-weight: 600;
}

.error {
  color: var(--kapa-negative);
}
</style>
