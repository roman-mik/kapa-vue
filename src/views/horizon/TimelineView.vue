<script setup lang="ts">
import { computed, ref } from 'vue';
import type { LedgerEvent } from '@roman-mik/kapa-core/horizon';
import BalanceLineChart from '@/components/horizon/BalanceLineChart.vue';
import NegativeDayBanner from '@/components/horizon/NegativeDayBanner.vue';
import WaterfallChart from '@/components/horizon/WaterfallChart.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useViewport } from '@/composables/useViewport';
import {
  RANGE_PRESETS,
  useHorizonTimeline,
  type RangeMonths,
} from '@/composables/useHorizonTimeline';
import { EVENT_GLYPHS, type GlyphShape } from '@/lib/eventGlyphs';
import { formatDay, formatFullDate, formatFullMonth } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { globalTrough } from '@/lib/horizon/trough';
import { timelineMonths } from '@/lib/horizon/timelineMonths';

const {
  loading,
  error,
  rangeMonths,
  reportingCurrency,
  days,
  events,
  metrics,
  warnings,
  daysUnderByMonth,
  dismiss,
} = useHorizonTimeline();
const { isDesktop } = useViewport();

const chartView = ref<'line' | 'waterfall'>('line');

const initialLoading = computed(() => loading.value && days.value.length === 0);

// One day-by-day list grouped by month; each month's header carries end
// balance, low point and days-under (assembled in the pure helper, never in
// the template).
const months = computed(() => timelineMonths(metrics.value, daysUnderByMonth.value, events.value));

const troughDate = computed(() => globalTrough(days.value)?.minBalanceDate ?? null);

function eventAmountTone(amountMinor: number): 'positive' | 'negative' {
  return amountMinor >= 0 ? 'positive' : 'negative';
}

// The "lowest point" tag is carried by shape + a text label, never by colour
// alone; the red tint is conditional on the row's own amount tone.
function isTroughDay(date: string): boolean {
  return troughDate.value !== null && date === troughDate.value;
}

function lowDateDay(date: string): string {
  return String(Number(date.slice(8)));
}

function onDismiss(dates: string[], reason: string): void {
  for (const date of dates) dismiss(date, reason);
}

function setRange(months: RangeMonths): void {
  rangeMonths.value = months;
}

function glyphShape(kind: LedgerEvent['kind']): GlyphShape {
  return EVENT_GLYPHS[kind].shape;
}
</script>

<template>
  <main class="page page--with-rail">
    <div class="page-main">
      <h1>Timeline</h1>

      <template v-if="initialLoading">
        <SkeletonBlock height="320px" radius="md" />
        <SkeletonBlock height="120px" />
      </template>

      <p v-else-if="error" role="alert" class="error">{{ error }}</p>

      <template v-else>
        <div class="controls">
          <div class="range-control" role="group" aria-label="Date range">
            <BaseButton
              v-for="opt in RANGE_PRESETS"
              :key="opt"
              variant="secondary"
              :class="{ active: rangeMonths === opt }"
              :aria-pressed="rangeMonths === opt"
              @click="setRange(opt)"
            >
              {{ opt }}m
            </BaseButton>
          </div>
          <div v-if="isDesktop" class="view-toggle" role="group" aria-label="Chart view">
            <BaseButton
              variant="secondary"
              :class="{ active: chartView === 'line' }"
              :aria-pressed="chartView === 'line'"
              @click="chartView = 'line'"
            >
              Balance line
            </BaseButton>
            <BaseButton
              variant="secondary"
              :class="{ active: chartView === 'waterfall' }"
              :aria-pressed="chartView === 'waterfall'"
              @click="chartView = 'waterfall'"
            >
              Waterfall
            </BaseButton>
          </div>
        </div>

        <NegativeDayBanner :warnings="warnings" @dismiss="onDismiss" />

        <BaseCard>
          <BalanceLineChart
            v-if="chartView === 'line'"
            :days="days"
            :events="events"
            :currency="reportingCurrency"
          />
          <WaterfallChart v-else :events="events" :currency="reportingCurrency" />
        </BaseCard>

        <section class="list-section">
          <EmptyState
            v-if="!months.length"
            title="No data"
            message="No months in the selected range."
          />
          <div v-else class="months">
            <div v-for="month in months" :key="month.month" class="month">
              <div class="month-header">
                <div class="month-summary">
                  <span class="month-name">{{ formatFullMonth(month.month) }}</span>
                  <span class="month-line">
                    ends {{ formatMoney(month.endBalanceMinor, reportingCurrency) }} · low
                    {{ formatMoney(month.minBalanceMinor, reportingCurrency) }} on the
                    {{ lowDateDay(month.minBalanceDate) }}
                  </span>
                </div>
                <BaseBadge v-if="month.daysUnder" class="under-badge">
                  {{ month.daysUnder }} {{ month.daysUnder === 1 ? 'day' : 'days' }} under
                </BaseBadge>
              </div>

              <EmptyState
                v-if="!month.events.length"
                title="No events"
                message="No scheduled events this month."
              />
              <div v-else class="rows">
                <div
                  v-for="event in month.events"
                  :key="`${event.date}-${event.sourceId}-${event.kind}`"
                  class="row"
                  :class="[
                    `row-${eventAmountTone(event.amountMinor)}`,
                    { trough: isTroughDay(event.date) },
                  ]"
                >
                  <span class="row-date">{{ formatDay(event.date) }}</span>
                  <span class="glyph" :class="`tone-${eventAmountTone(event.amountMinor)}`">
                    <svg width="18" height="18" viewBox="0 0 18 18">
                      <circle v-if="glyphShape(event.kind) === 'circle'" cx="9" cy="9" r="6" />
                      <rect
                        v-else-if="glyphShape(event.kind) === 'square'"
                        x="3"
                        y="3"
                        width="12"
                        height="12"
                        rx="3"
                      />
                      <polygon
                        v-else-if="glyphShape(event.kind) === 'diamond'"
                        :points="`9,2 16,9 9,16 2,9`"
                      />
                      <polygon
                        v-else-if="glyphShape(event.kind) === 'triangle-down'"
                        :points="`9,15 2,4 16,4`"
                      />
                      <polygon
                        v-else-if="glyphShape(event.kind) === 'triangle-up'"
                        :points="`9,3 16,14 2,14`"
                      />
                      <circle
                        v-else
                        cx="9"
                        cy="9"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      />
                    </svg>
                  </span>
                  <span class="row-label">
                    <span class="row-name">{{ event.label }}</span>
                    <span v-if="isTroughDay(event.date)" class="trough-tag">lowest point</span>
                  </span>
                  <span class="row-meta">
                    <span class="amount" :class="`tone-${eventAmountTone(event.amountMinor)}`">
                      {{ formatMoney(event.amountMinor, reportingCurrency) }}
                    </span>
                    <span class="leaf-balance">
                      {{ formatMoney(event.balanceAfterMinor, reportingCurrency) }}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </div>

    <aside v-if="isDesktop" class="page-side">
      <BaseCard class="side-card">
        <h2 class="side-heading">Month summary</h2>
        <EmptyState
          v-if="!metrics?.months.length"
          title="No data"
          message="No months in the selected range."
        />
        <table v-else class="month-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">End</th>
              <th scope="col">Min</th>
              <th scope="col">Days under</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="month in months" :key="month.month">
              <td>{{ formatFullMonth(month.month) }}</td>
              <td>{{ formatMoney(month.endBalanceMinor, reportingCurrency) }}</td>
              <td>
                {{ formatMoney(month.minBalanceMinor, reportingCurrency) }}
                <span class="min-date">{{ formatFullDate(month.minBalanceDate) }}</span>
              </td>
              <td>
                <BaseBadge v-if="month.daysUnder" variant="expected">
                  {{ month.daysUnder }}
                </BaseBadge>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </BaseCard>
    </aside>
  </main>
</template>

<style scoped>
.error {
  color: var(--kapa-negative);
  margin: 0;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  margin-bottom: var(--kapa-space-4);
}

.range-control,
.view-toggle {
  display: flex;
  gap: var(--kapa-space-2);
}

:deep(.btn.active) {
  background: var(--kapa-accent);
  color: var(--kapa-white);
  border-color: var(--kapa-accent);
}

.list-section {
  margin-top: var(--kapa-space-5);
}

.months {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-5);
}

.month {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.month-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: var(--kapa-neutral-100);
  border-radius: var(--kapa-radius-md);
}

.month-summary {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.month-name {
  font-weight: 700;
  color: var(--kapa-ink);
}

.month-line {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.under-badge {
  flex: none;
  background: color-mix(in srgb, var(--kapa-negative) 14%, transparent);
  color: var(--kapa-negative);
}

.rows {
  display: flex;
  flex-direction: column;
}

.row {
  display: grid;
  grid-template-columns: 44px 22px minmax(0, 1fr) auto;
  gap: var(--kapa-space-2);
  align-items: center;
  padding: var(--kapa-space-3) var(--kapa-space-3);
  border-bottom: 1px solid var(--kapa-neutral-300);
}

.row:first-child {
  border-top: 1px solid var(--kapa-neutral-300);
}

.row.trough {
  background: color-mix(in srgb, var(--kapa-negative) 9%, transparent);
}

.row-date {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
}

.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
}

.glyph svg {
  fill: currentColor;
}

.amount.tone-positive,
.glyph.tone-positive {
  color: var(--kapa-positive-700);
}

.amount.tone-negative,
.glyph.tone-negative {
  color: var(--kapa-negative);
}

.row-label {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.row-name {
  font-weight: 600;
  color: var(--kapa-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trough-tag {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--kapa-negative);
}

.row-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
}

.amount {
  font-weight: 700;
}

.leaf-balance {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.page-side {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.side-card {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.side-heading {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--kapa-ink-muted);
}

.month-table {
  width: 100%;
  border-collapse: collapse;
}

.month-table th,
.month-table td {
  text-align: left;
  padding: var(--kapa-space-2) var(--kapa-space-2);
  border-bottom: 1px solid var(--kapa-neutral-300);
  font-size: var(--kapa-text-caption-size);
  vertical-align: top;
}

.month-table th {
  color: var(--kapa-ink-muted);
  font-weight: 600;
}

.min-date {
  display: block;
  color: var(--kapa-ink-muted);
}
</style>
