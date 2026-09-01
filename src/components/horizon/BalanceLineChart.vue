<script setup lang="ts">
import type { LedgerEvent, ProjectionDay } from '@roman-mik/kapa-core/horizon';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import EventGlyph from './EventGlyph.vue';
import { balanceDomain, balanceScaleY } from '@/lib/balanceScale';
import { EVENT_GLYPHS } from '@/lib/eventGlyphs';
import { globalTrough } from '@/lib/horizon/trough';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';

const props = defineProps<{
  days: ProjectionDay[];
  events: LedgerEvent[];
  currency: Currency;
}>();

const PADDING = { top: 20, right: 24, bottom: 32, left: 56 };
const CHART_HEIGHT = 300;
const PX_PER_DAY = 8;
const MIN_WIDTH = 600;

const width = computed(() =>
  Math.max(MIN_WIDTH, props.days.length * PX_PER_DAY + PADDING.left + PADDING.right)
);
const chartWidth = computed(() => width.value - PADDING.left - PADDING.right);
const chartHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

const domain = computed(() => balanceDomain(props.days.map((d) => d.balanceMinor)));

function scaleX(index: number): number {
  const n = props.days.length;
  if (n <= 1) return PADDING.left + chartWidth.value / 2;
  return PADDING.left + (index / (n - 1)) * chartWidth.value;
}

function scaleY(balance: number): number {
  return balanceScaleY(balance, domain.value, PADDING.top, chartHeight);
}

interface Point {
  x: number;
  y: number;
  balance: number;
}

const points = computed<Point[]>(() =>
  props.days.map((d, i) => ({ x: scaleX(i), y: scaleY(d.balanceMinor), balance: d.balanceMinor }))
);

interface Segment {
  path: string;
  negative: boolean;
}

function toPath(pts: { x: number; y: number }[]): string {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

// One neutral-colored path, split at zero-crossings so negative-balance runs
// can be dashed in addition to (never instead of) the shared stroke color —
// the distinction survives grayscale/colorblind viewing, unlike a red/green
// stroke flip.
const segments = computed<Segment[]>(() => {
  const pts = points.value;
  if (pts.length === 0) return [];
  const segs: Segment[] = [];
  let current: { x: number; y: number }[] = [pts[0]];
  let currentNegative = pts[0].balance < 0;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const pt = pts[i];
    const ptNegative = pt.balance < 0;
    if (currentNegative !== ptNegative) {
      const t = prev.balance / (prev.balance - pt.balance);
      const crossing = { x: prev.x + t * (pt.x - prev.x), y: scaleY(0) };
      current.push(crossing);
      segs.push({ path: toPath(current), negative: currentNegative });
      current = [crossing];
      currentNegative = ptNegative;
    }
    current.push(pt);
  }
  segs.push({ path: toPath(current), negative: currentNegative });
  return segs;
});

const NEGATIVE_STROKE_WIDTH = 3.5;
const NEUTRAL_STROKE_WIDTH = 2;
const hasNegativeDay = computed(() => props.days.some((d) => d.balanceMinor < 0));
const zeroY = computed(() => scaleY(0));
const bandHeight = computed(() => PADDING.top + chartHeight - zeroY.value);

const dayIndexByDate = computed(() => {
  const map = new Map<string, number>();
  props.days.forEach((d, i) => map.set(d.date, i));
  return map;
});

// The projection-wide low point, paired with its formatted amount. This is the
// same `globalTrough` the Today hero and the timeline list use, so the chart and
// the list can never disagree about where the trough is. Null when there is no
// trough to point at (fewer than 2 days or every day non-negative).
const hasTrough = computed(() => {
  if (props.days.length < 2) return false;
  const trough = globalTrough(props.days);
  return trough !== null && trough.minBalanceMinor < 0;
});

const CALL_TICK = 10;
const CALL_PILL_W = 108;
const CALL_PILL_H = 20;

const troughCallout = computed<{
  x: number;
  y: number;
  tickY: number;
  label: string;
} | null>(() => {
  if (!hasTrough.value) return null;
  const trough = globalTrough(props.days)!;
  const index = dayIndexByDate.value.get(trough.minBalanceDate);
  if (index === undefined) return null;

  const x = scaleX(index);
  const y = scaleY(trough.minBalanceMinor);
  // Clamp the pill inside the plot so it never straddles the plot edge or the
  // marker column at the presets; drop it below the trough point (the artboard
  // places it under the line).
  const pillX = Math.min(
    Math.max(x - CALL_PILL_W / 2, PADDING.left),
    PADDING.left + chartWidth.value - CALL_PILL_W
  );
  return {
    x: pillX,
    y,
    tickY: y + CALL_TICK,
    label: `low ${formatMoney(trough.minBalanceMinor, props.currency)}`,
  };
});

interface Marker {
  key: string;
  x: number;
  y: number;
  shape: (typeof EVENT_GLYPHS)[LedgerEvent['kind']]['shape'];
  kind: LedgerEvent['kind'];
  tooltip: string;
  positive: boolean;
}

const markers = computed<Marker[]>(() =>
  props.events
    .filter((e) => !e.unconvertible)
    .map((e): Marker | null => {
      const index = dayIndexByDate.value.get(e.date);
      if (index === undefined) return null;
      return {
        key: `${e.date}-${e.sourceId}-${e.kind}`,
        x: scaleX(index),
        y: scaleY(e.balanceAfterMinor),
        shape: EVENT_GLYPHS[e.kind].shape,
        kind: e.kind,
        tooltip: `${e.label}: ${formatMoney(e.amountMinor, props.currency)} on ${formatFullDate(e.date)}`,
        positive: e.amountMinor >= 0,
      };
    })
    .filter((m): m is Marker => m !== null)
);

const summaryText = computed(() => {
  if (props.days.length === 0) return 'No projection data.';
  const first = props.days[0];
  const last = props.days[props.days.length - 1];
  const negativeCount = props.days.filter((d) => d.balanceMinor < 0).length;
  return (
    `Balance projection over ${props.days.length} days, from ` +
    `${formatMoney(first.balanceMinor, props.currency)} to ${formatMoney(last.balanceMinor, props.currency)}. ` +
    `${negativeCount} day(s) go negative.`
  );
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
        v-if="hasNegativeDay"
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

      <path
        v-for="(segment, i) in segments"
        :key="i"
        class="balance-line"
        :class="{ negative: segment.negative }"
        :d="segment.path"
        :stroke-width="segment.negative ? NEGATIVE_STROKE_WIDTH : NEUTRAL_STROKE_WIDTH"
        fill="none"
      />

      <g v-if="troughCallout" class="trough-callout">
        <line
          class="trough-tick"
          :x1="troughCallout.x + CALL_PILL_W / 2"
          :y1="troughCallout.y"
          :x2="troughCallout.x + CALL_PILL_W / 2"
          :y2="troughCallout.tickY"
        />
        <rect
          class="trough-pill"
          :x="troughCallout.x"
          :y="troughCallout.tickY"
          :width="CALL_PILL_W"
          :height="CALL_PILL_H"
          rx="10"
        />
        <text
          class="trough-label"
          :x="troughCallout.x + CALL_PILL_W / 2"
          :y="troughCallout.tickY + CALL_PILL_H / 2"
          text-anchor="middle"
        >
          {{ troughCallout.label }}
        </text>
      </g>

      <g
        v-for="marker in markers"
        :key="marker.key"
        class="marker"
        :class="[`marker-${marker.kind}`, marker.positive ? 'tone-positive' : 'tone-negative']"
        :data-kind="marker.kind"
      >
        <EventGlyph :shape="marker.shape" :x="marker.x" :y="marker.y" />
        <title>{{ marker.tooltip }}</title>
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

.balance-line {
  stroke: var(--kapa-accent);
}

/* Underwater runs are drawn both heavier (bound inline from the script, so the
   weight is deterministic and testable) AND dashed — the weight and the dash
   both survive colorblind/grayscale viewing, so the distinction never rests on
   the stroke colour alone. */
.balance-line.negative {
  stroke: var(--kapa-negative);
  stroke-dasharray: 6, 3;
}

.trough-tick {
  stroke: var(--kapa-negative);
  stroke-width: 1.5;
}

.trough-pill {
  fill: var(--kapa-negative);
}

.trough-label {
  fill: #fff;
  font-size: var(--kapa-text-caption-size);
  font-weight: 700;
  dominant-baseline: central;
}

.marker {
  fill: var(--kapa-ink);
  cursor: default;
}

.marker.tone-positive {
  fill: var(--kapa-positive-700);
}

.marker.tone-negative {
  fill: var(--kapa-negative);
}
</style>
