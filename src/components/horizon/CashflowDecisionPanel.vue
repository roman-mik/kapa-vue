<script setup lang="ts">
import { computed } from 'vue';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import type { DecisionWindow } from '@roman-mik/kapa-core/horizon';
import type { CashflowDecision } from '@/composables/useCashflowDecision';
import CautiousEditor from './CautiousEditor.vue';
import CashflowTrialEditor from './CashflowTrialEditor.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { formatMoney } from '@/lib/money';
const props = defineProps<{ decision: CashflowDecision }>();
const result = computed(() => props.decision.result.value);
const currency = computed(() => props.decision.input.value?.reportingCurrency ?? 'RSD');
const windows = computed(() => {
  const s = result.value?.summary;
  return s
    ? [
        { title: 'Selected forecast', value: s.selected },
        ...(s.nextIncome.window
          ? [{ title: 'Through next income', value: s.nextIncome.window }]
          : []),
      ]
    : [];
});
function verdict(w: DecisionWindow): string {
  if (!props.decision.qualified.value)
    return 'Cannot assess cash coverage until the missing inputs are reviewed.';
  if (w.zeroShortfallMinor > 0)
    return `Cash deficit ${formatMoney(w.zeroShortfallMinor, currency.value)}; first below zero on ${w.firstZeroBreach?.date}.`;
  if (w.reserveShortfallMinor === null)
    return 'Cash stays nonnegative under these assumptions. Set or clear the reserve in reporting currency to assess reserve coverage.';
  if (w.reserveShortfallMinor > 0)
    return `Cash stays nonnegative but falls ${formatMoney(w.reserveShortfallMinor, currency.value)} below reserve; first breach on ${w.firstReserveBreach?.date}.`;
  return `Under these assumptions, included cash stays at or above your reserve through ${w.to}.`;
}
function names(ids: string[]) {
  return ids.map((id) => props.decision.accountNames.value.get(id) ?? id).join(', ') || 'None';
}
const included = computed(
  () =>
    props.decision.input.value?.accounts
      .filter((a) => !a.archived && a.include_in_total)
      .map((a) => a.id) ?? []
);
const excluded = computed(
  () =>
    props.decision.input.value?.accounts
      .filter((a) => a.archived || !a.include_in_total)
      .map((a) => a.id) ?? []
);
</script>
<template>
  <BaseCard class="decision-panel">
    <h2>Bill coverage and cashflow</h2>
    <CautiousEditor :decision="decision" />
    <CashflowTrialEditor :decision="decision" />
    <p v-if="decision.error.value" role="alert">{{ decision.error.value }}</p>
    <p v-else-if="!decision.ready.value" role="status">
      Forecast updating or unavailable. Coverage cannot be assessed yet.
    </p>
    <template v-if="result">
      <p>
        {{ decision.store.mode === 'cautious' ? 'Cautious' : 'Expected' }} ·
        {{ result.summary.selected.from }} through {{ result.summary.selected.to }}, inclusive.
      </p>
      <p v-if="decision.trialStore.draft && decision.comparisonSummary.value">
        Before trial → with trial: lowest cash
        {{ formatMoney(decision.comparisonSummary.value.selected.minimum.balanceMinor, currency) }}
        → {{ formatMoney(result.summary.selected.minimum.balanceMinor, currency) }}; endpoint
        {{ formatMoney(decision.comparisonSummary.value.selected.endingCashMinor, currency) }} →
        {{ formatMoney(result.summary.selected.endingCashMinor, currency) }}. Next-income endpoint
        {{ decision.comparisonSummary.value.nextIncome.date ?? 'Unavailable' }} →
        {{ result.summary.nextIncome.date ?? 'Unavailable' }}.
      </p>
      <p>
        Estimated cash before today’s scheduled movements:
        {{ formatMoney(result.summary.selected.startingCashMinor, currency)
        }}{{ !decision.qualified.value ? ' (known-only; needs review)' : '' }}.
      </p>
      <p v-if="decision.reserveMismatch.value">
        <router-link :to="{ name: 'horizon-settings', hash: '#reserve' }"
          >Set or clear the reserve in {{ currency }}</router-link
        >.
      </p>
      <p v-else>
        Reserve:
        {{
          decision.reserveUnset.value
            ? 'No reserve set (zero cash floor)'
            : decision.reserve.value === 0
              ? 'Zero cash floor'
              : formatMoney(decision.reserve.value ?? 0, currency)
        }}.
        <router-link :to="{ name: 'horizon-settings', hash: '#reserve' }">Edit reserve</router-link>
      </p>
      <div class="windows">
        <section v-for="w in windows" :key="w.title" class="window">
          <h3>{{ w.title }}</h3>
          <p>{{ w.value.from }} through {{ w.value.to }}</p>
          <p class="verdict" role="status">{{ verdict(w.value) }}</p>
          <dl>
            <dt>Lowest cash{{ !decision.qualified.value ? ' (known-only)' : '' }}</dt>
            <dd>
              {{ formatMoney(w.value.minimum.balanceMinor, currency) }} on
              {{ w.value.minimum.date }} · {{ w.value.minimum.cause }}
            </dd>
            <dt>Projected endpoint{{ !decision.qualified.value ? ' (known-only)' : '' }}</dt>
            <dd>{{ formatMoney(w.value.endingCashMinor, currency) }}</dd>
            <template v-if="decision.qualified.value"
              ><dt>Zero shortfall</dt>
              <dd>{{ formatMoney(w.value.zeroShortfallMinor, currency) }}</dd>
              <dt>First below zero</dt>
              <dd>{{ w.value.firstZeroBreach?.date ?? 'No breach in this window' }}</dd>
              <dt>First below reserve</dt>
              <dd>
                {{
                  w.value.reserveShortfallMinor === null
                    ? 'Unavailable'
                    : (w.value.firstReserveBreach?.date ?? 'No breach in this window')
                }}
              </dd>
              <dt>Reserve shortfall</dt>
              <dd>
                {{
                  w.value.reserveShortfallMinor === null
                    ? 'Unavailable'
                    : formatMoney(w.value.reserveShortfallMinor, currency)
                }}
              </dd></template
            >
          </dl>
        </section>
      </div>
      <p v-if="result.summary.nextIncome.status === 'outside'">
        Next income on {{ result.summary.nextIncome.date }} is outside this forecast. Its coverage
        outcome is unavailable.
      </p>
      <p v-else-if="result.summary.nextIncome.status === 'none'">
        No next income scheduled. This forecast does not establish indefinite runway.
      </p>
      <p v-else-if="result.summary.nextIncome.status === 'unknown'">
        No next income found through {{ result.summary.nextIncome.lookupThrough }}. Later income is
        unknown; the next-income outcome is unavailable.
      </p>
      <template v-if="decision.store.mode === 'cautious' && decision.baselineSummary.value">
        <h3>Expected → cautious on the same selected endpoint</h3>
        <p>
          Lowest cash:
          {{ formatMoney(decision.baselineSummary.value.selected.minimum.balanceMinor, currency) }}
          → {{ formatMoney(result.summary.selected.minimum.balanceMinor, currency) }}.
        </p>
        <p>
          Endpoint cash:
          {{ formatMoney(decision.baselineSummary.value.selected.endingCashMinor, currency) }} →
          {{ formatMoney(result.summary.selected.endingCashMinor, currency) }}.
        </p>
        <p>
          Next-income endpoint:
          {{ decision.baselineSummary.value.nextIncome.date ?? 'Unavailable' }} →
          {{ result.summary.nextIncome.date ?? 'Unavailable' }}.
        </p>
      </template>
      <details>
        <summary>Monthly movements and cash assumptions</summary>
        <section v-for="m in result.summary.months" :key="m.month">
          <h3>
            {{ m.month }}{{ m.partial ? ' (partial month)' : ''
            }}{{ !decision.qualified.value ? ' · known-only' : '' }}
          </h3>
          <p>
            {{ m.from }} through {{ m.to }}: money in {{ formatMoney(m.inflowsMinor, currency) }},
            money out {{ formatMoney(m.outflowsMinor, currency) }}, net movement
            {{ formatMoney(m.netMovementMinor, currency) }}.
          </p>
          <p>
            Starting {{ formatMoney(m.startingCashMinor, currency) }} + net movement = ending
            {{ formatMoney(m.endingCashMinor, currency) }}. This is not recurring savings capacity.
          </p>
        </section>
        <p>Included accounts: {{ names(included) }}. Excluded accounts: {{ names(excluded) }}.</p>
        <p v-for="o in decision.observations.value" :key="o.id">
          Bank check: {{ decision.accountNames.value.get(o.accountId) ?? o.accountId }} ·
          {{ formatMoney(o.balanceMinor, o.currency as Currency) }} on {{ o.date }}.
        </p>
        <p v-if="!decision.observations.value.length">
          No bank observations available; legacy balances are not trusted current cash.
        </p>
      </details>
      <p class="scope-note">
        This evaluates aggregate included cash. It does not prove the paying account can settle a
        bill; excluded-account bills are outside this forecast. Same-day order is modeled, not bank
        timestamps.
      </p>
    </template>
  </BaseCard>
</template>
<style scoped>
.decision-panel {
  margin-block: var(--kapa-space-4);
  overflow-wrap: anywhere;
}
.windows {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
  gap: var(--kapa-space-4);
}
.window {
  border-top: 1px solid var(--kapa-neutral-400);
  padding-top: var(--kapa-space-3);
}
dt {
  color: var(--kapa-ink-muted);
}
dd {
  margin: 0 0 var(--kapa-space-3);
}
.verdict {
  font-weight: 600;
}
summary {
  cursor: pointer;
  min-height: 44px;
}
.scope-note {
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}
</style>
