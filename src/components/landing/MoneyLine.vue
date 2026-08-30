<script setup lang="ts">
// The landing page's signature element: the same four month-end points read
// as "comfortably solvent" until the real daily line is drawn underneath
// them and dips through zero — Horizon's reason to exist, in one gesture
// (domain rule D2, see tracker/docs/horizon-user-stories.md §2).
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { formatMoney } from '@/lib/money';
import type { HorizonProjection } from '@/lib/landing/horizonDemo';

const props = defineProps<{ projection: HorizonProjection }>();

type ViewMode = 'month-end' | 'daily';

const VIEW_W = 800;
const VIEW_H = 240;
const PAD_X = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 36;

const days = computed(() => props.projection.dailyBalances);

const monthEndIndices = computed(() =>
  props.projection.monthEnd.map((m) => ({
    index: days.value.findIndex((d) => d.date === m.date),
    value: m.balanceMinor,
    date: m.date,
  }))
);

const trough = computed(() => {
  let lowest = days.value[0]!;
  let index = 0;
  days.value.forEach((d, i) => {
    if (d.balanceMinor < lowest.balanceMinor) {
      lowest = d;
      index = i;
    }
  });
  return { ...lowest, index };
});

const domain = computed(() => {
  const values = days.value.map((d) => d.balanceMinor);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  return { min: min - span * 0.12, max: max + span * 0.12 };
});

function xFor(index: number): number {
  const usableW = VIEW_W - PAD_X * 2;
  const count = Math.max(days.value.length - 1, 1);
  return PAD_X + (index / count) * usableW;
}

function yFor(value: number): number {
  const usableH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const { min, max } = domain.value;
  const t = (value - min) / (max - min || 1);
  return PAD_TOP + usableH * (1 - t);
}

const zeroY = computed(() => yFor(0));

const dailyPath = computed(() =>
  days.value
    .map(
      (d, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(d.balanceMinor).toFixed(1)}`
    )
    .join(' ')
);

// The "month end" view: a gentle line connecting only the four month-end
// points — what a month-end-only report would show. Deliberately smoother
// and higher than the truth.
const monthEndPath = computed(() =>
  monthEndIndices.value
    .map((m, i) => `${i === 0 ? 'M' : 'L'} ${xFor(m.index).toFixed(1)} ${yFor(m.value).toFixed(1)}`)
    .join(' ')
);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const mode = ref<ViewMode>(prefersReducedMotion ? 'daily' : 'month-end');
const autoPlayed = ref(prefersReducedMotion);
let autoTimer: ReturnType<typeof setTimeout> | undefined;

onMounted(() => {
  if (prefersReducedMotion) return;
  autoTimer = setTimeout(() => {
    mode.value = 'daily';
    autoPlayed.value = true;
  }, 900);
});

onUnmounted(() => {
  clearTimeout(autoTimer);
});

function select(next: ViewMode): void {
  autoPlayed.value = true; // a manual choice cancels any pending auto-reveal
  clearTimeout(autoTimer);
  mode.value = next;
}

const monthEndBtn = ref<HTMLButtonElement | null>(null);
const dailyBtn = ref<HTMLButtonElement | null>(null);

function onKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const next: ViewMode = mode.value === 'month-end' ? 'daily' : 'month-end';
  select(next);
  (next === 'month-end' ? monthEndBtn : dailyBtn).value?.focus();
}

const hoverIndex = ref<number | null>(null);
const hoverDay = computed(() => (hoverIndex.value === null ? null : days.value[hoverIndex.value]));

function onHover(event: MouseEvent): void {
  const target = event.currentTarget as SVGSVGElement;
  const rect = target.getBoundingClientRect();
  const relX = ((event.clientX - rect.left) / rect.width) * VIEW_W;
  const count = Math.max(days.value.length - 1, 1);
  const usableW = VIEW_W - PAD_X * 2;
  const approx = Math.round(((relX - PAD_X) / usableW) * count);
  hoverIndex.value = Math.min(Math.max(approx, 0), days.value.length - 1);
}
</script>

<template>
  <div class="money-line">
    <div class="chart-head">
      <span class="eyebrow l-mono">The money line</span>
      <div class="toggle" role="radiogroup" aria-label="Chart view" @keydown="onKeydown">
        <button
          ref="monthEndBtn"
          type="button"
          role="radio"
          :aria-checked="mode === 'month-end'"
          class="toggle-btn"
          :class="{ active: mode === 'month-end' }"
          :tabindex="mode === 'month-end' ? 0 : -1"
          @click="select('month-end')"
        >
          Month end
        </button>
        <button
          ref="dailyBtn"
          type="button"
          role="radio"
          :aria-checked="mode === 'daily'"
          class="toggle-btn"
          :class="{ active: mode === 'daily' }"
          :tabindex="mode === 'daily' ? 0 : -1"
          @click="select('daily')"
        >
          Every day
        </button>
      </div>
    </div>

    <svg
      :viewBox="`0 0 ${VIEW_W} ${VIEW_H}`"
      preserveAspectRatio="xMidYMid meet"
      class="chart"
      role="img"
      aria-label="Balance chart comparing month-end snapshots to the true daily balance"
      @mousemove="onHover"
      @mouseleave="hoverIndex = null"
    >
      <line :x1="PAD_X" :x2="VIEW_W - PAD_X" :y1="zeroY" :y2="zeroY" class="zero-line" />

      <path
        v-if="mode === 'daily'"
        :d="dailyPath"
        class="daily-path"
        :class="{ drawn: autoPlayed }"
      />
      <path v-else :d="monthEndPath" class="month-end-path" />

      <template v-if="mode === 'daily'">
        <circle
          v-if="trough.balanceMinor < 0"
          :cx="xFor(trough.index)"
          :cy="yFor(trough.balanceMinor)"
          r="4.5"
          class="trough-dot"
        />
      </template>

      <circle
        v-for="m in monthEndIndices"
        :key="m.date"
        :cx="xFor(m.index)"
        :cy="yFor(m.value)"
        r="4"
        class="month-end-dot"
      />

      <line
        v-if="hoverDay"
        :x1="xFor(hoverIndex!)"
        :x2="xFor(hoverIndex!)"
        :y1="PAD_TOP"
        :y2="VIEW_H - PAD_BOTTOM"
        class="hover-line"
      />
    </svg>

    <p v-if="mode === 'daily' && trough.balanceMinor < 0" class="trough-label l-mono">
      {{ formatMoney(trough.balanceMinor, projection.currency) }} ·
      {{
        new Date(trough.date).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })
      }}
    </p>
    <p v-else-if="mode === 'month-end'" class="trough-label muted">
      Every month end, comfortably positive.
    </p>

    <p v-if="hoverDay" class="hover-readout l-mono" role="status">
      {{
        new Date(hoverDay.date).toLocaleDateString(undefined, {
          day: 'numeric',
          month: 'short',
          timeZone: 'UTC',
        })
      }}
      · {{ formatMoney(hoverDay.balanceMinor, projection.currency) }}
    </p>
  </div>
</template>

<style scoped>
.money-line {
  background: var(--l-horizon-panel);
  border: 1px solid var(--l-line);
  border-radius: 20px;
  padding: 20px 20px 16px;
  box-shadow: 0 16px 32px -18px rgb(76 96 62 / 0.2);
}

.chart-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--l-haze);
}

.toggle {
  display: inline-flex;
  border: 1px solid var(--l-line);
  border-radius: 999px;
  padding: 2px;
  gap: 2px;
}

.toggle-btn {
  font: inherit;
  font-family: var(--l-font-mono);
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: var(--l-haze);
  cursor: pointer;
}

.toggle-btn.active {
  background: var(--l-surface);
  color: var(--l-ink);
}

.toggle-btn:focus-visible,
.toggle-btn.active:focus-visible {
  outline: 2px solid var(--l-signal);
  outline-offset: 2px;
}

.chart {
  width: 100%;
  height: auto;
  display: block;
}

.zero-line {
  stroke: var(--l-haze);
  stroke-opacity: 0.4;
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

.month-end-path {
  fill: none;
  stroke: var(--l-signal);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.month-end-dot {
  fill: var(--l-signal);
}

.daily-path {
  fill: none;
  stroke: var(--l-signal);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 2000;
  stroke-dashoffset: 0;
}

.daily-path.drawn {
  animation: draw 700ms var(--l-motion-ease, cubic-bezier(0.4, 0, 0.2, 1)) both;
}

@keyframes draw {
  from {
    stroke-dashoffset: 2000;
  }
  to {
    stroke-dashoffset: 0;
  }
}

.trough-dot {
  fill: var(--l-alarm);
  stroke: var(--l-horizon-panel);
  stroke-width: 2;
}

.hover-line {
  stroke: var(--l-haze);
  stroke-width: 1;
  opacity: 0.5;
}

.trough-label {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--l-alarm);
}

.trough-label.muted {
  color: var(--l-haze);
  font-family: var(--l-font-body);
}

.hover-readout {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--l-haze);
}

@media (prefers-reduced-motion: reduce) {
  .daily-path.drawn {
    animation: none;
  }
}

@media (max-width: 520px) {
  .toggle-btn {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
}
</style>
