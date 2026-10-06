<script setup lang="ts">
import ForecastStatusNotice from '@/components/horizon/ForecastStatusNotice.vue';
import PaymentList from '@/components/horizon/PaymentList.vue';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import type { NegativeDayWarning } from '@roman-mik/kapa-core/horizon';
const paymentAction = usePaymentActionSheet();
function reviewWarning(warning: NegativeDayWarning) {
  if (warning.fix.kind === 'shiftPayment' && warning.fix.event.occurrenceId)
    paymentAction.open(warning.fix.event.occurrenceId);
  else void router.push(paymentReviewRoute(warning));
}
import CashflowReviewNotice from '@/components/horizon/CashflowReviewNotice.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
const paymentLink = usePaymentLinkSheet();
import { useRouter } from 'vue-router';
import { paymentReviewRoute } from '@/lib/horizon/paymentReview';
const router = useRouter();
import type { Currency } from '@roman-mik/kapa-core/pocket';
import ProjectionCompletenessNotice from '@/components/horizon/ProjectionCompletenessNotice.vue';
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

const { accounts, loading: accountsLoading, error: accountsError } = useAccounts();
const {
  assessment,
  conversionIssues,
  lifecycleIssues,
  isPartial,
  refresh,
  loading,
  error,
  reportingCurrency,
  spendMode,
  capMinor,
  trough,
  balanceToday,
  lifecycleEnabled,
  estimatedCash,
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
      <h1 tabindex="-1">Today</h1>
      <ForecastStatusNotice :assessment="assessment" :loading="loading" :error="error" />
      <CashflowReviewNotice :issues="lifecycleIssues" />
      <div class="review-actions">
        <BaseButton variant="secondary" @click="paymentLink.open()">
          Review payments and balances
        </BaseButton>
      </div>
      <ProjectionCompletenessNotice
        :issues="conversionIssues"
        :currency="reportingCurrency"
        :loading="loading"
        :error="error"
        @retry="refresh"
      />

      <template v-if="initialLoading">
        <SkeletonBlock height="180px" radius="lg" />
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="error" role="alert" class="error">{{ error }}</p>

      <template v-else>
        <div class="hero">
          <section
            class="hero-stat hero-trough"
            :class="{ 'has-shortfall': troughTone === 'negative' }"
          >
            <p class="hero-label">Lowest point ahead{{ isPartial ? ' (partial)' : '' }}</p>
            <p class="hero-value" :class="`tone-${troughTone}`">
              {{ trough ? formatMoney(trough.minBalanceMinor, reportingCurrency) : '—' }}
            </p>
            <p v-if="trough" class="hero-sub">
              {{ formatFullDate(trough.minBalanceDate) }} · {{ daysUnderCount }} days under
            </p>
          </section>

          <div class="hero-secondary">
            <section v-if="lifecycleEnabled" class="hero-stat">
              <p class="hero-label">Estimated cash now{{ isPartial ? ' (needs review)' : '' }}</p>
              <p class="hero-value">
                {{ estimatedCash !== null ? formatMoney(estimatedCash, reportingCurrency) : '—' }}
              </p>
            </section>
            <section class="hero-stat">
              <p class="hero-label">Projected end of today{{ isPartial ? ' (partial)' : '' }}</p>
              <p class="hero-value">
                {{ balanceToday !== null ? formatMoney(balanceToday, reportingCurrency) : '—' }}
              </p>
            </section>
            <section v-if="monthEnd" class="hero-stat">
              <p class="hero-label">{{ monthEndLabel }}{{ isPartial ? ' (partial)' : '' }}</p>
              <p class="hero-value">
                {{ formatMoney(monthEnd.balanceMinor, reportingCurrency) }}
              </p>
            </section>
          </div>
        </div>

        <NegativeDayBanner :warnings="warnings" @dismiss="onDismiss" @fix="reviewWarning" />

        <section class="section">
          <h2>Next up</h2>
          <ul v-if="nextEvents.length" class="list">
            <li v-for="event in nextEvents" :key="`${event.date}-${event.sourceId}`" class="row">
              <div class="row-info">
                <button
                  v-if="event.occurrenceId"
                  type="button"
                  class="payment-action"
                  @click="paymentAction.open(event.occurrenceId)"
                >
                  {{ event.label }}</button
                ><span v-else class="row-name">{{ event.label }}</span>
                <span class="note"
                  >{{ formatFullDate(event.date) }} · {{ isPartial ? 'partial balance' : 'leaves' }}
                  {{ formatMoney(event.balanceAfterMinor, reportingCurrency) }}</span
                >
              </div>
              <span class="amount" :class="`tone-${eventAmountTone(event.amountMinor)}`">
                {{
                  event.unconvertible
                    ? formatMoney(event.nativeAmountMinor, event.nativeCurrency as Currency) +
                      ' (conversion unavailable)'
                    : formatMoney(event.amountMinor, reportingCurrency)
                }}
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
        <h2 class="side-heading">Account balances</h2>
        <p v-if="lifecycleEnabled" class="note">
          Last checked balances; estimated cash above also includes reviewed movements since those
          checks.
        </p>
        <p v-if="accountsLoading && !accounts.length" role="status">Loading accounts…</p>
        <p v-else-if="accountsError" role="alert">{{ accountsError }}</p>
        <AccountChips v-else-if="accounts.length" :accounts="accounts" />
        <EmptyState v-else title="No accounts yet" message="Start with the money you have today." />
        <router-link class="account-action" :to="{ name: 'horizon-accounts' }">{{
          accounts.length || accountsLoading || accountsError ? 'Manage accounts' : 'Add account'
        }}</router-link>
      </BaseCard>

      <BaseCard v-if="spendMode === 'cap'" class="side-card">
        <h2 class="side-heading">This projection assumes</h2>
        <CapAssumptionNote :cap-minor="capMinor" :currency="reportingCurrency" />
      </BaseCard>
    </aside>
    <PaymentList />
  </main>
</template>

<style scoped>
.review-actions {
  display: flex;
  flex-wrap: wrap;
  margin-block: var(--kapa-space-4) var(--kapa-space-5);
}
.review-actions .btn {
  min-height: 44px;
}

.payment-action {
  font: inherit;
  text-align: left;
  color: var(--kapa-ink);
  background: none;
  border: 0;
  min-height: 44px;
  text-decoration: underline;
  cursor: pointer;
}
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

.hero-value {
  overflow-wrap: anywhere;
}

@media (max-width: 759px) {
  .hero-secondary .hero-value {
    font-size: clamp(1rem, 4vw, 1.5rem);
  }
  .hero-secondary .hero-stat {
    min-width: 0;
    padding-inline: var(--kapa-space-3);
  }
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
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr));
  }

  .hero-trough.has-shortfall {
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
  max-width: 50%;
  overflow-wrap: anywhere;
  text-align: right;
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

<style scoped>
.review-actions {
  display: flex;
  flex-wrap: wrap;
  margin-block: var(--kapa-space-4) var(--kapa-space-5);
}
.review-actions .btn {
  min-height: 44px;
}

.payment-action {
  font: inherit;
  text-align: left;
  color: var(--kapa-ink);
  background: none;
  border: 0;
  min-height: 44px;
  text-decoration: underline;
  cursor: pointer;
}
.account-action {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--kapa-accent-800);
  font-weight: 600;
}
</style>
