<script setup lang="ts">
import { computed } from 'vue';
import { formatMonthLabel } from '@roman-mik/kapa-core/horizon';
import AccountChips from '@/components/horizon/AccountChips.vue';
import CapAssumptionNote from '@/components/horizon/CapAssumptionNote.vue';
import NegativeDayBanner from '@/components/horizon/NegativeDayBanner.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useHorizonToday } from '@/composables/useHorizonToday';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';

const { accounts } = useAccounts();
const {
  loading,
  error,
  reportingCurrency,
  spendMode,
  capMinor,
  trough,
  balanceToday,
  monthEnd,
  nextEvents,
  warnings,
  daysUnderCount,
  dismiss,
} = useHorizonToday();

const initialLoading = computed(() => loading.value && trough.value === null);
const troughTone = computed<'default' | 'negative'>(() =>
  trough.value && trough.value.minBalanceMinor < 0 ? 'negative' : 'default'
);
const monthEndLabel = computed(() =>
  monthEnd.value ? `End of ${formatMonthLabel(monthEnd.value.month)}` : ''
);

function onDismiss(dates: string[], reason: string): void {
  for (const date of dates) dismiss(date, reason);
}

function eventAmountTone(amountMinor: number): 'positive' | 'negative' {
  return amountMinor >= 0 ? 'positive' : 'negative';
}
</script>

<template>
  <main class="page page--with-rail">
    <div class="page-main">
      <h1>Today</h1>

      <template v-if="initialLoading">
        <SkeletonBlock height="180px" radius="lg" />
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="error" role="alert" class="error">{{ error }}</p>

      <template v-else>
        <div class="hero">
          <section class="hero-stat hero-trough">
            <p class="hero-label">Lowest point ahead</p>
            <p class="hero-value" :class="`tone-${troughTone}`">
              {{ trough ? formatMoney(trough.minBalanceMinor, reportingCurrency) : '—' }}
            </p>
            <p v-if="trough" class="hero-sub">
              {{ formatFullDate(trough.minBalanceDate) }} · {{ daysUnderCount }} days under
            </p>
          </section>

          <div class="hero-secondary">
            <section class="hero-stat">
              <p class="hero-label">Balance today</p>
              <p class="hero-value">
                {{ balanceToday !== null ? formatMoney(balanceToday, reportingCurrency) : '—' }}
              </p>
            </section>
            <section v-if="monthEnd" class="hero-stat">
              <p class="hero-label">{{ monthEndLabel }}</p>
              <p class="hero-value">
                {{ formatMoney(monthEnd.balanceMinor, reportingCurrency) }}
              </p>
            </section>
          </div>
        </div>

        <NegativeDayBanner :warnings="warnings" @dismiss="onDismiss" />

        <section class="section">
          <h2>Next up</h2>
          <ul v-if="nextEvents.length" class="list">
            <li v-for="event in nextEvents" :key="`${event.date}-${event.sourceId}`" class="row">
              <div class="row-info">
                <span class="row-name">{{ event.label }}</span>
                <span class="note"
                  >{{ formatFullDate(event.date) }} · leaves
                  {{ formatMoney(event.balanceAfterMinor, reportingCurrency) }}</span
                >
              </div>
              <span class="amount" :class="`tone-${eventAmountTone(event.amountMinor)}`">
                {{ formatMoney(event.amountMinor, reportingCurrency) }}
              </span>
            </li>
          </ul>
          <EmptyState
            v-else
            title="Nothing scheduled"
            message="No upcoming events in the next 90 days."
          />
        </section>
      </template>
    </div>

    <aside class="page-side">
      <BaseCard class="side-card">
        <h2 class="side-heading">Accounts</h2>
        <AccountChips v-if="accounts.length" :accounts="accounts" />
        <EmptyState v-else title="No accounts yet" message="Add an account to see it here." />
      </BaseCard>

      <BaseCard v-if="spendMode === 'cap'" class="side-card">
        <h2 class="side-heading">This projection assumes</h2>
        <CapAssumptionNote :cap-minor="capMinor" :currency="reportingCurrency" />
      </BaseCard>
    </aside>
  </main>
</template>

<style scoped>
.error {
  color: var(--kapa-negative);
  margin: 0;
}

.hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--kapa-space-4);
  margin-bottom: var(--kapa-space-5);
}

.hero-trough {
  box-shadow: inset 0 0 0 1px var(--kapa-neutral-400);
}

.hero-secondary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--kapa-space-4);
}

.hero-stat {
  background: var(--kapa-surface);
  border-radius: var(--kapa-radius-md);
  box-shadow: var(--kapa-shadow-sm);
  padding: var(--kapa-space-4) var(--kapa-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.hero-label {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--kapa-ink-muted);
}

.hero-value {
  margin: 0;
  font-family: var(--font-heading);
  font-size: var(--kapa-text-display-size);
  line-height: 1.05;
  letter-spacing: -0.015em;
  color: var(--kapa-ink);
}

.hero-value.tone-negative {
  color: var(--kapa-negative);
}

.hero-sub {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
  font-weight: 600;
}

@media (min-width: 760px) {
  .hero {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .hero-trough {
    box-shadow: inset 0 0 0 2px var(--kapa-negative);
  }

  .hero-secondary {
    display: contents;
  }
}

.section {
  margin-bottom: var(--kapa-space-5);
}

.section h2 {
  margin-bottom: var(--kapa-space-3);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.row-name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.note {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.amount {
  font-weight: 600;
  margin-left: auto;
}

.amount.tone-positive {
  color: var(--kapa-positive-700);
}

.amount.tone-negative {
  color: var(--kapa-negative);
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
</style>
