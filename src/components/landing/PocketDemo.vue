<script setup lang="ts">
// Live Pocket demo for the landing page — every readout below is computed by
// the same @roman-mik/kapa-core/pocket functions PocketHomeView.vue calls in
// the real app (see src/lib/landing/pocketDemo.ts). Tapping a category adds
// its representative expense to a fixture month; nothing here is faked.
import { computed, ref } from 'vue';
import { formatMoney } from '@/lib/money';
import { DEMO_CATEGORIES, DEMO_STARTING_SPENT, pocketDemoSummary } from '@/lib/landing/pocketDemo';

const added = ref<string[]>([]);

const spent = computed(() =>
  added.value.reduce((total, id) => {
    const category = DEMO_CATEGORIES.find((c) => c.id === id);
    return total + (category?.amountMinor ?? 0);
  }, DEMO_STARTING_SPENT)
);

const summary = computed(() => pocketDemoSummary(spent.value));

function addExpense(id: string): void {
  added.value = [...added.value, id];
}

function reset(): void {
  added.value = [];
}

const barPct = computed(() => summary.value.spentPct);
const barState = computed<'healthy' | 'nudge' | 'over'>(() => {
  const home = summary.value.home;
  if (home.kind === 'no-cap') return 'healthy';
  if (home.kind === 'over') return 'over';
  return home.nudge ? 'nudge' : 'healthy';
});
</script>

<template>
  <div class="pocket-demo">
    <div class="demo-head">
      <span class="eyebrow l-mono">Pocket · try it</span>
      <button v-if="added.length" type="button" class="reset" @click="reset">Reset</button>
    </div>

    <p class="spent l-mono">{{ formatMoney(summary.spent, summary.currency) }}</p>
    <p class="spent-label">spent this month of {{ formatMoney(summary.cap, summary.currency) }}</p>

    <div
      class="bar"
      role="progressbar"
      :aria-valuenow="barPct"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="bar-fill" :class="barState" :style="{ width: `${Math.min(barPct, 100)}%` }" />
    </div>

    <p v-if="summary.home.kind === 'over'" class="line over">
      {{ formatMoney(summary.overspend, summary.currency) }} over your cap.
      <template v-if="summary.home.recovery.suggested">
        Next month, try {{ formatMoney(summary.home.recovery.cap, summary.currency) }}.
      </template>
    </p>
    <p v-else class="line">
      {{ formatMoney(summary.remaining, summary.currency) }} left ·
      {{ formatMoney(summary.safeDaily, summary.currency) }}/day is safe to spend.
    </p>

    <ul class="chips" aria-label="Add a sample expense">
      <li v-for="category in DEMO_CATEGORIES" :key="category.id">
        <button type="button" class="chip" @click="addExpense(category.id)">
          {{ category.name }}
          <span class="chip-amount l-mono"
            >+{{ formatMoney(category.amountMinor, summary.currency) }}</span
          >
        </button>
      </li>
    </ul>

    <p class="note">This runs the same cap math as the app — tap a category to see it move.</p>
  </div>
</template>

<style scoped>
.pocket-demo {
  background: var(--l-paper);
  color: #201e1d;
  border-radius: 24px;
  padding: var(--kapa-space-6, 24px);
  box-shadow: 0 16px 32px -18px rgb(80 55 30 / 0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.demo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--l-ember-strong, #8c491a);
}

.reset {
  font: inherit;
  font-family: var(--l-font-mono);
  font-size: 12px;
  background: none;
  border: none;
  color: #82796a;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.reset:hover,
.reset:focus-visible {
  color: #201e1d;
}

.reset:focus-visible {
  outline: 2px solid #c67139;
  outline-offset: 2px;
}

.spent {
  font-size: 40px;
  font-weight: 500;
  margin: 0;
  line-height: 1;
}

.spent-label {
  margin: 0;
  font-size: 13px;
  color: #645c50;
}

.bar {
  height: 10px;
  border-radius: 999px;
  background: #dcd3c4;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  border-radius: inherit;
  transition: width 240ms var(--l-motion-ease, cubic-bezier(0.4, 0, 0.2, 1));
  background: #8fa073;
}

.bar-fill.nudge {
  background: #c98a2c;
}

.bar-fill.over {
  background: #b23a2c;
}

.line {
  margin: 0;
  font-size: 14px;
  color: #474238;
}

.line.over {
  color: #8c491a;
  font-weight: 600;
}

.chips {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  font: inherit;
  font-size: 13px;
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid #dcd3c4;
  background: #f9f4ed;
  color: #201e1d;
  cursor: pointer;
}

.chip:hover,
.chip:focus-visible {
  border-color: #c67139;
}

.chip:focus-visible {
  outline: 2px solid #c67139;
  outline-offset: 2px;
}

.chip-amount {
  color: #82796a;
}

.note {
  margin: 4px 0 0;
  font-size: 12px;
  color: #82796a;
}

@media (prefers-reduced-motion: reduce) {
  .bar-fill {
    transition: none;
  }
}
</style>
