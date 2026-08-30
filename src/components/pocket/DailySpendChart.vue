<script setup lang="ts">
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import { formatMoney } from '@/lib/money';

const props = defineProps<{
  days: { dateKey: string; amountMinor: number }[];
  referenceLine: number;
  currency: Currency;
}>();

// The tallest bar sets the scale; the reference line can exceed every bar
// (a cautious cap) or fall below all of them (an already-blown one), so it
// has to enter the same max as the data, not just the bars.
const maxValue = computed(() =>
  Math.max(props.referenceLine, ...props.days.map((d) => d.amountMinor), 1)
);

const bars = computed(() =>
  props.days.map((d) => ({
    ...d,
    heightPct: (d.amountMinor / maxValue.value) * 100,
    over: d.amountMinor > props.referenceLine,
  }))
);

const referenceLinePct = computed(() => (props.referenceLine / maxValue.value) * 100);

const total = computed(() => props.days.reduce((sum, d) => sum + d.amountMinor, 0));
const overDayCount = computed(() => bars.value.filter((b) => b.over).length);

const summaryText = computed(
  () =>
    `Daily spending this month, total ${formatMoney(total.value, props.currency)}. ` +
    `Reference line at ${formatMoney(props.referenceLine, props.currency)} per day. ` +
    `${overDayCount.value} of ${props.days.length} days went over that line.`
);

function dayOfMonth(dateKey: string): string {
  return String(Number(dateKey.slice(-2)));
}
</script>

<template>
  <figure class="chart" role="img" :aria-label="summaryText">
    <div class="bars">
      <div class="reference-line" :style="{ bottom: `${referenceLinePct}%` }" />
      <div
        v-for="bar in bars"
        :key="bar.dateKey"
        class="bar-col"
        :title="`${dayOfMonth(bar.dateKey)}: ${formatMoney(bar.amountMinor, currency)}`"
      >
        <div
          class="bar"
          :class="{ over: bar.over }"
          :style="{ height: `${Math.max(bar.heightPct, bar.amountMinor > 0 ? 2 : 0)}%` }"
        />
      </div>
    </div>
    <figcaption class="caption">
      {{ formatMoney(referenceLine, currency) }}/day reference
    </figcaption>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.bars {
  position: relative;
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 96px;
  padding-top: var(--kapa-space-2);
  overflow-x: auto;
  scrollbar-width: none;
}

.bars::-webkit-scrollbar {
  display: none;
}

@media (max-width: 400px) {
  /* kapa-core BREAKPOINT.sm — narrow phones need taller bars to stay
   * individually readable once they're only a few px wide. */
  .bars {
    height: 112px;
  }
}

.reference-line {
  position: absolute;
  left: 0;
  right: 0;
  border-top: 1px dashed var(--kapa-ink-subtle);
}

.bar-col {
  flex: 1 1 0;
  min-width: 4px;
  height: 100%;
  display: flex;
  align-items: flex-end;
}

.bar {
  width: 100%;
  min-height: 0;
  border-radius: 2px 2px 0 0;
  background: var(--kapa-accent);
  transition: height var(--kapa-motion-base) var(--kapa-motion-ease);
}

.bar.over {
  background: var(--kapa-negative);
}

.caption {
  margin: 0;
  color: var(--kapa-ink-subtle);
  font-size: var(--kapa-text-caption-size);
  text-align: right;
}
</style>
