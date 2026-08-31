<script setup lang="ts">
import { computed } from 'vue';
import AccountChips from '@/components/horizon/AccountChips.vue';
import CapAssumptionNote from '@/components/horizon/CapAssumptionNote.vue';
import NegativeDayBanner from '@/components/horizon/NegativeDayBanner.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import StatBlock from '@/components/ui/StatBlock.vue';
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
  endBalanceMinor,
  monthMin,
  nextEvents,
  warnings,
  dismiss,
} = useHorizonToday();

const initialLoading = computed(() => loading.value && monthMin.value === null);
const endBalanceTone = computed(() => (endBalanceMinor.value < 0 ? 'negative' : 'default'));

function eventAmountTone(amountMinor: number): 'positive' | 'negative' {
  return amountMinor >= 0 ? 'positive' : 'negative';
}
</script>

<template>
  <main class="page">
    <h1>Today</h1>

    <template v-if="initialLoading">
      <SkeletonBlock height="120px" radius="md" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <BaseCard class="hero-card">
        <StatBlock
          :value="formatMoney(endBalanceMinor, reportingCurrency)"
          label="end of horizon"
          :tone="endBalanceTone"
        />
        <StatBlock
          v-if="monthMin"
          :value="formatMoney(monthMin.minBalanceMinor, reportingCurrency)"
          :label="`lowest point, ${monthMin.minBalanceDate}`"
          :tone="monthMin.minBalanceMinor < 0 ? 'negative' : 'default'"
        />
      </BaseCard>

      <NegativeDayBanner :warnings="warnings" @dismiss="dismiss" />

      <section class="section">
        <h2>Accounts</h2>
        <AccountChips v-if="accounts.length" :accounts="accounts" />
        <EmptyState v-else title="No accounts yet" message="Add an account to see it here." />
      </section>

      <section class="section">
        <h2>Next up</h2>
        <ul v-if="nextEvents.length" class="list">
          <li v-for="event in nextEvents" :key="`${event.date}-${event.sourceId}`" class="row">
            <div class="row-info">
              <span class="row-name">{{ event.label }}</span>
              <span class="note">{{ formatFullDate(event.date) }}</span>
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

      <CapAssumptionNote
        v-if="spendMode === 'cap'"
        :cap-minor="capMinor"
        :currency="reportingCurrency"
      />
    </template>
  </main>
</template>

<style scoped>
.hero-card {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
  margin-bottom: var(--kapa-space-5);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
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
</style>
