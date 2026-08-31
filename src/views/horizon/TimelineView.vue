<script setup lang="ts">
import { computed, ref } from 'vue';
import BalanceLineChart from '@/components/horizon/BalanceLineChart.vue';
import NegativeDayBanner from '@/components/horizon/NegativeDayBanner.vue';
import WaterfallChart from '@/components/horizon/WaterfallChart.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import {
  RANGE_PRESETS,
  useHorizonTimeline,
  type RangeMonths,
} from '@/composables/useHorizonTimeline';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';

const { loading, error, rangeMonths, reportingCurrency, days, events, metrics, warnings, dismiss } =
  useHorizonTimeline();

const chartView = ref<'line' | 'waterfall'>('line');

const initialLoading = computed(() => loading.value && days.value.length === 0);

function eventAmountTone(amountMinor: number): 'positive' | 'negative' {
  return amountMinor >= 0 ? 'positive' : 'negative';
}

function setRange(months: RangeMonths): void {
  rangeMonths.value = months;
}
</script>

<template>
  <main class="page">
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
        <div class="view-toggle" role="group" aria-label="Chart view">
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

      <NegativeDayBanner :warnings="warnings" @dismiss="dismiss" />

      <BaseCard>
        <BalanceLineChart
          v-if="chartView === 'line'"
          :days="days"
          :events="events"
          :currency="reportingCurrency"
        />
        <WaterfallChart v-else :events="events" :currency="reportingCurrency" />
      </BaseCard>

      <section class="section">
        <h2>Month summary</h2>
        <EmptyState
          v-if="!metrics?.months.length"
          title="No data"
          message="No months in the selected range."
        />
        <table v-else class="month-table">
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Month-end balance</th>
              <th scope="col">Intra-month minimum</th>
              <th scope="col">Minimum date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="month in metrics.months" :key="month.month">
              <td>{{ month.month }}</td>
              <td>{{ formatMoney(month.endBalanceMinor, reportingCurrency) }}</td>
              <td>{{ formatMoney(month.minBalanceMinor, reportingCurrency) }}</td>
              <td>{{ formatFullDate(month.minBalanceDate) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section class="section">
        <h2>Event detail</h2>
        <EmptyState
          v-if="!events.length"
          title="No events"
          message="No scheduled events in the selected range."
        />
        <table v-else class="event-table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Kind</th>
              <th scope="col">Label</th>
              <th scope="col">Amount</th>
              <th scope="col">Balance after</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in events" :key="`${event.date}-${event.sourceId}-${event.kind}`">
              <td>{{ formatFullDate(event.date) }}</td>
              <td>{{ event.kind }}</td>
              <td>{{ event.label }}</td>
              <td :class="`tone-${eventAmountTone(event.amountMinor)}`">
                {{ formatMoney(event.amountMinor, reportingCurrency) }}
              </td>
              <td>{{ formatMoney(event.balanceAfterMinor, reportingCurrency) }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </template>
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

.section {
  margin-top: var(--kapa-space-5);
}

.section h2 {
  margin-bottom: var(--kapa-space-3);
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  text-align: left;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border-bottom: 1px solid var(--kapa-neutral-300);
  font-size: var(--kapa-text-caption-size);
}

th {
  color: var(--kapa-ink-muted);
  font-weight: 600;
}

.tone-positive {
  color: var(--kapa-positive-700);
}

.tone-negative {
  color: var(--kapa-negative);
}
</style>
