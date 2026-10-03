<script setup lang="ts">
import { computed } from 'vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
import type { PocketSummary } from '@/composables/usePocketHome';
import { formatMoney } from '@/lib/money';

// Caller is expected to only render this for `summary.home.kind !== 'no-cap'`
// — the "set a cap" empty state stays a separate, simpler card at the call
// site rather than a third branch in here.
const props = defineProps<{ summary: PocketSummary }>();

// No dedicated cap field exists on PocketSummary — `remaining` is already
// `cap - spent` (kapa-core's `remaining()`), so this recovers the cap total
// without adding a field just for display.
const capMinor = computed(() => props.summary.spent + props.summary.remaining);

const barState = computed<'healthy' | 'nudge' | 'over'>(() => {
  const home = props.summary.home;
  if (home.kind === 'over') return 'over';
  if (home.kind === 'in-budget') return home.nudge ? 'nudge' : 'healthy';
  return 'healthy';
});

// The fill itself clamps at 100% (a wider-than-track bar has nowhere to go),
// but the on-bar label still reports the true percentage — this is the
// shape/label-backed signal the design brief requires instead of colour alone.
const fillPct = computed(() => Math.min(props.summary.spentPct, 100));
const labelPct = computed(() => Math.round(props.summary.spentPct));

const showPace = computed(
  () => props.summary.home.kind === 'in-budget' && props.summary.home.showPace
);

// evenPaceMinor = spent + paceGap (paceGap is kapa-core's evenPace - spent) —
// derived from already-exposed summary fields rather than adding a new one
// just for this marker's position and the "even pace today would be" line.
const evenPaceMinor = computed(() => props.summary.spent + props.summary.paceGap);

const paceMarkerPct = computed(() => {
  if (!showPace.value || capMinor.value <= 0) return null;
  return Math.min(Math.max((evenPaceMinor.value / capMinor.value) * 100, 0), 100);
});

const eyebrow = computed(() =>
  props.summary.home.kind === 'over' ? 'over your cap' : 'left this month'
);

const heroValue = computed(() =>
  formatMoney(
    props.summary.home.kind === 'over' ? props.summary.overspend : props.summary.remaining,
    props.summary.currency
  )
);
</script>

<template>
  <BaseCard class="cap-card" data-testid="cap-progress-card">
    <p class="eyebrow">{{ eyebrow }}</p>
    <p
      class="hero money-amount"
      :class="{ 'money-amount--negative': summary.home.kind === 'over' }"
    >
      {{ heroValue }}
    </p>

    <div
      class="track"
      role="progressbar"
      :aria-valuenow="labelPct"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="fill" :class="`state-${barState}`" :style="{ width: `${fillPct}%` }">
        <span class="fill-label">{{ labelPct }}%</span>
      </div>
      <div
        v-if="paceMarkerPct !== null"
        class="pace-marker"
        :style="{ left: `${paceMarkerPct}%` }"
      />
    </div>

    <div class="track-row">
      <span class="spent-line">
        {{ formatMoney(summary.spent, summary.currency) }} spent of
        {{ formatMoney(capMinor, summary.currency) }}
      </span>
      <span v-if="showPace" class="pace-line">
        even pace today would be {{ formatMoney(evenPaceMinor, summary.currency) }}
      </span>
    </div>

    <div class="stats">
      <StatBlock
        v-if="summary.home.kind === 'in-budget'"
        :value="formatMoney(summary.safeDaily, summary.currency)"
        label="safe a day"
      />
      <StatBlock
        :value="summary.daysUntilReset === 1 ? '1 day' : `${summary.daysUntilReset} days`"
        label="until reset"
      />
    </div>

    <p v-if="summary.home.kind === 'over' && summary.home.recovery.suggested" class="narrative">
      To even out, consider next month's cap at
      {{ formatMoney(summary.home.recovery.cap, summary.currency) }}.
    </p>

    <p
      v-if="summary.home.kind === 'in-budget' && summary.home.nudge"
      class="narrative narrative--warn"
    >
      You're approaching your cap —
      {{ formatMoney(summary.safeDaily, summary.currency) }}/day left for the rest of the month.
    </p>

    <p v-if="showPace" class="narrative">
      <template v-if="summary.paceGap >= 0">
        {{ formatMoney(summary.paceGap, summary.currency) }} under an even pace.
      </template>
      <template v-else>
        {{ formatMoney(-summary.paceGap, summary.currency) }} over an even pace.
      </template>
    </p>

    <p v-if="summary.home.kind === 'in-budget' && summary.home.showProjection" class="narrative">
      Projected to land at {{ formatMoney(summary.projection, summary.currency) }} by month end.
    </p>
  </BaseCard>
</template>

<style scoped>
.cap-card {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.eyebrow {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--kapa-ink-muted);
}

.hero {
  margin: 0;
  font-size: calc(var(--kapa-text-display-size) * 1.6);
  line-height: 1.05;
}

.track {
  position: relative;
  height: 24px;
  border-radius: 999px;
  background: var(--kapa-neutral-300);
  overflow: hidden;
}

.fill {
  height: 100%;
  min-width: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 var(--kapa-space-2);
  background: var(--kapa-accent);
  transition: width var(--kapa-motion-base) var(--kapa-motion-ease);
}

.fill.state-nudge {
  background: var(--kapa-accent-700);
}

.fill.state-over {
  background: var(--kapa-negative);
}

.fill-label {
  font-size: var(--kapa-text-caption-size);
  font-weight: 700;
  color: var(--kapa-white);
  white-space: nowrap;
}

.pace-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--kapa-ink);
  opacity: 0.5;
}

.track-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--kapa-space-2);
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.spent-line {
  font-weight: 600;
  color: var(--kapa-ink);
}

.stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--kapa-space-3);
}

.narrative {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.narrative--warn {
  color: var(--kapa-negative);
  font-weight: 600;
}
</style>
