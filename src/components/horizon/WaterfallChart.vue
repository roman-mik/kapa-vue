<script setup lang="ts">
import type { EventKind, LedgerEvent } from '@roman-mik/kapa-core/horizon';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import EventGlyph from './EventGlyph.vue';
import { balanceDomain, balanceScaleY } from '@/lib/balanceScale';
import { EVENT_GLYPHS } from '@/lib/eventGlyphs';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';

const props = defineProps<{
  events: LedgerEvent[];
  currency: Currency;
}>();

const PADDING = { top: 20, right: 24, bottom: 32, left: 56 };
const CHART_HEIGHT = 300;
const BAR_SLOT = 40;
const BAR_WIDTH = 24;
const MIN_WIDTH = 600;

interface Bucket {
  key: string;
  date: string;
  kind: EventKind;
  balanceBeforeMinor: number;
  balanceAfterMinor: number;
  amountMinor: number;
  label: string;
}

// Same-day events of the same kind are bucketed into one bar (audited from
// tracker's WaterfallChart approach, rebuilt against kapa-core's real
// LedgerEvent[] — never copied): otherwise a multi-month range with several
// income/obligation events per month would render an illegible bar-per-event
// chart.
const buckets = computed<Bucket[]>(() => {
  interface Accumulator {
    date: string;
    kind: EventKind;
    balanceBeforeMinor: number;
    balanceAfterMinor: number;
    amountMinor: number;
    label: string;
    count: number;
  }
  const map = new Map<string, Accumulator>();
  const order: string[] = [];
  for (const e of props.events) {
    if (e.unconvertible) continue;
    const key = `${e.date}:${e.kind}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        date: e.date,
        kind: e.kind,
        balanceBeforeMinor: e.balanceBeforeMinor,
        balanceAfterMinor: e.balanceAfterMinor,
        amountMinor: e.amountMinor,
        label: e.label,
        count: 1,
      });
      order.push(key);
    } else {
      existing.balanceAfterMinor = e.balanceAfterMinor;
      existing.amountMinor += e.amountMinor;
      existing.count += 1;
    }
  }
  return order
    .map((key) => {
      const b = map.get(key)!;
      return {
        key,
        date: b.date,
        kind: b.kind,
        balanceBeforeMinor: b.balanceBeforeMinor,
        balanceAfterMinor: b.balanceAfterMinor,
        amountMinor: b.amountMinor,
        label: b.count > 1 ? `${b.count} events` : b.label,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.balanceBeforeMinor - b.balanceBeforeMinor);
});

const width = computed(() =>
  Math.max(MIN_WIDTH, buckets.value.length * BAR_SLOT + PADDING.left + PADDING.right)
);
const chartWidth = computed(() => width.value - PADDING.left - PADDING.right);
const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

const domain = computed(() =>
  balanceDomain(buckets.value.flatMap((b) => [b.balanceBeforeMinor, b.balanceAfterMinor]))
);

function scaleY(balance: number): number {
  return balanceScaleY(balance, domain.value, PADDING.top, chartHeight);
}

function centerX(index: number): number {
  return PADDING.left + index * BAR_SLOT + BAR_SLOT / 2;
}

interface Bar {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  glyphX: number;
  glyphY: number;
  labelX: number;
  labelY: number;
  shape: (typeof EVENT_GLYPHS)[EventKind]['shape'];
  kind: EventKind;
  positive: boolean;
  tooltip: string;
  amountText: string;
}

const bars = computed<Bar[]>(() =>
  buckets.value.map((b, i): Bar => {
    const cx = centerX(i);
    const yBefore = scaleY(b.balanceBeforeMinor);
    const yAfter = scaleY(b.balanceAfterMinor);
    const top = Math.min(yBefore, yAfter);
    const bottom = Math.max(yBefore, yAfter);
    const glyphY = Math.max(PADDING.top + 10, top - 10);
    return {
      key: b.key,
      x: cx - BAR_WIDTH / 2,
      y: top,
      width: BAR_WIDTH,
      height: Math.max(1, bottom - top),
      glyphX: cx,
      glyphY,
      labelX: cx,
      labelY: Math.max(PADDING.top - 4, glyphY - 12),
      shape: EVENT_GLYPHS[b.kind].shape,
      kind: b.kind,
      positive: b.amountMinor >= 0,
      tooltip: `${b.label}: ${formatMoney(b.amountMinor, props.currency)} on ${formatFullDate(b.date)}`,
      amountText: formatMoney(b.amountMinor, props.currency),
    };
  })
);

const hasNegative = computed(() => buckets.value.some((b) => b.balanceAfterMinor < 0));
const zeroY = computed(() => scaleY(0));
const bandHeight = computed(() => PADDING.top + chartHeight - zeroY.value);

const summaryText = computed(() => {
  if (buckets.value.length === 0) return 'No events in range.';
  return `Waterfall of ${buckets.value.length} grouped events across the selected range.`;
});
</script>

<template>
  <div class="chart-scroll">
    <svg
      role="img"
      :aria-label="summaryText"
      :width="width"
      :height="CHART_HEIGHT"
      :viewBox="`0 0 ${width} ${CHART_HEIGHT}`"
    >
      <rect
        v-if="hasNegative"
        class="negative-band"
        :x="PADDING.left"
        :y="zeroY"
        :width="chartWidth"
        :height="bandHeight"
      />

      <line
        class="zero-line"
        :x1="PADDING.left"
        :x2="PADDING.left + chartWidth"
        :y1="zeroY"
        :y2="zeroY"
      />
      <text class="zero-label" :x="PADDING.left - 8" :y="zeroY" text-anchor="end">0</text>

      <g v-for="bar in bars" :key="bar.key" class="bar-group" :data-kind="bar.kind">
        <rect
          class="bar"
          :class="[`bar-${bar.kind}`, bar.positive ? 'tone-positive' : 'tone-negative']"
          :x="bar.x"
          :y="bar.y"
          :width="bar.width"
          :height="bar.height"
        >
          <title>{{ bar.tooltip }}</title>
        </rect>
        <g class="glyph" :class="bar.positive ? 'tone-positive' : 'tone-negative'">
          <EventGlyph :shape="bar.shape" :x="bar.glyphX" :y="bar.glyphY" :size="4" />
        </g>
        <text class="amount-label" :x="bar.labelX" :y="bar.labelY" text-anchor="middle">
          {{ bar.amountText }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.chart-scroll {
  overflow-x: auto;
  scrollbar-width: none;
}

.chart-scroll::-webkit-scrollbar {
  display: none;
}

svg {
  display: block;
}

.negative-band {
  fill: color-mix(in srgb, var(--kapa-negative) 12%, transparent);
}

.zero-line {
  stroke: var(--kapa-ink-subtle);
  stroke-width: 1;
  stroke-dasharray: 2, 2;
}

.zero-label {
  fill: var(--kapa-ink-subtle);
  font-size: var(--kapa-text-caption-size);
}

.bar {
  stroke: var(--kapa-surface);
  stroke-width: 1;
}

.bar.tone-positive {
  fill: var(--kapa-positive-700);
}

.bar.tone-negative {
  fill: var(--kapa-negative);
}

.glyph {
  fill: var(--kapa-ink);
}

.glyph.tone-positive {
  fill: var(--kapa-positive-700);
}

.glyph.tone-negative {
  fill: var(--kapa-negative);
}

.amount-label {
  fill: var(--kapa-ink-subtle);
  font-size: 9px;
}
</style>
