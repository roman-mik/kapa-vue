<script setup lang="ts">
import { computed, ref } from 'vue';
import { CURRENCIES, CURRENCY_EXPONENT, convertToCurrency } from '@roman-mik/kapa-core/pocket';
import { occurrenceFingerprint } from '@roman-mik/kapa-core/horizon';
import type { CashflowDecision } from '@/composables/useCashflowDecision';
import BaseButton from '@/components/ui/BaseButton.vue';
import { usePocketEntrySheet } from '@/composables/usePocketEntrySheet';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import { trialAllowance } from '@/lib/horizon/purchaseTrial';
import { formatMoney } from '@/lib/money';
const props = defineProps<{ decision: CashflowDecision }>();
const draft = computed(() => props.decision.trialStore.draft);
const base = computed(() => props.decision.scenarioInput.value);
const allowanceDate = ref('');
const allowanceAmount = ref('');
const localError = ref('');
const pocketSheet = usePocketEntrySheet();
const paymentSheet = usePaymentActionSheet();
const persistedBill = computed(() => {
  const d = draft.value;
  return d?.kind === 'billDate'
    ? props.decision.input.value?.lifecycle?.occurrences.find(
        (o) => o.expected.key === d.occurrenceKey
      )
    : undefined;
});
function record() {
  const d = draft.value;
  if (!d || !props.decision.ready.value) return;
  if (d.kind === 'purchase') {
    pocketSheet.open({
      prefill: {
        amountMinor: d.amountMinor,
        currency: d.currency,
        date: d.date,
        categoryId: null,
        note: d.name.trim() || null,
        countsTowardCap: covered.value > 0 && covered.value === converted.value,
      },
    });
  } else {
    const bill = persistedBill.value;
    if (!bill) return;
    paymentSheet.open(bill.id, { date: d.date, fingerprint: occurrenceFingerprint(bill) });
  }
  props.decision.trialStore.reset();
}
const bills = computed(() => props.decision.trialCandidates.value);
const forward = computed(() => {
  const totals = new Map<string, number>();
  for (const d of base.value ? trialAllowance(base.value) : []) {
    if (d.dateKey < base.value!.todayKey || d.dateKey > base.value!.range.to) continue;
    totals.set(d.dateKey, (totals.get(d.dateKey) ?? 0) + d.amountMinor);
  }
  return [...totals].filter(([, amount]) => amount > 0);
});
const amount = computed({
  get: () =>
    draft.value?.kind === 'purchase' && draft.value.amountMinor > 0
      ? String(draft.value.amountMinor / 10 ** CURRENCY_EXPONENT[draft.value.currency])
      : '',
  set: (text: string) => {
    if (draft.value?.kind === 'purchase') {
      const exponent = CURRENCY_EXPONENT[draft.value.currency];
      draft.value.amountMinor =
        /^\d+(\.\d+)?$/.test(text) && (text.split('.')[1]?.length ?? 0) <= exponent
          ? Math.round(Number(text) * 10 ** exponent)
          : 0;
    }
  },
});
const covered = computed(() =>
  draft.value?.kind === 'purchase'
    ? draft.value.allocations.reduce((s, a) => s + a.amountMinor, 0)
    : 0
);
const converted = computed(() =>
  draft.value?.kind === 'purchase' && base.value
    ? convertToCurrency(
        draft.value.amountMinor,
        draft.value.currency,
        base.value.reportingCurrency,
        draft.value.date,
        base.value.rates
      )
    : undefined
);
function start(kind: 'purchase' | 'billDate') {
  const b = base.value;
  if (!b) return;
  localError.value = '';
  if (kind === 'purchase')
    props.decision.trialStore.draft = {
      kind,
      name: '',
      amountMinor: 0,
      currency: b.reportingCurrency,
      accountId: b.accounts.find((a) => a.include_in_total && !a.archived)?.id ?? '',
      date: b.todayKey,
      allocationCurrency: b.reportingCurrency,
      allocations: [],
    };
  else if (bills.value[0]) selectBill(bills.value[0].expected.key);
}
function selectBill(key: string) {
  const bill = bills.value.find((o) => o.expected.key === key);
  if (!bill) return;
  props.decision.trialStore.draft = {
    kind: 'billDate',
    occurrenceKey: key,
    fingerprint: occurrenceFingerprint(bill),
    date: bill.postponedDate ?? bill.expected.date,
  };
}
function allocate() {
  if (draft.value?.kind !== 'purchase' || !base.value) return;
  const exponent = CURRENCY_EXPONENT[base.value.reportingCurrency];
  const amountMinor = Math.round(Number(allowanceAmount.value) * 10 ** exponent);
  const availableMinor = forward.value.find(([date]) => date === allowanceDate.value)?.[1];
  if (
    !/^\d+(\.\d+)?$/.test(allowanceAmount.value) ||
    (allowanceAmount.value.split('.')[1]?.length ?? 0) > exponent ||
    !Number.isSafeInteger(amountMinor) ||
    amountMinor <= 0 ||
    availableMinor === undefined
  ) {
    localError.value = 'Choose an allowance date and a positive amount.';
    return;
  }
  draft.value.allocations = [
    ...draft.value.allocations.filter((a) => a.date !== allowanceDate.value),
    { date: allowanceDate.value, amountMinor, availableMinor },
  ];
  draft.value.allocationCurrency = base.value.reportingCurrency;
  localError.value = '';
}
function review() {
  const current = draft.value;
  if (current?.kind === 'billDate') {
    const bill = bills.value.find((o) => o.expected.key === current.occurrenceKey);
    if (bill) current.fingerprint = occurrenceFingerprint(bill);
  } else if (draft.value?.kind === 'purchase' && base.value) {
    draft.value.allocationCurrency = base.value.reportingCurrency;
    draft.value.allocations = draft.value.allocations.map((a) => ({
      ...a,
      availableMinor: forward.value.find(([date]) => date === a.date)?.[1] ?? 0,
    }));
  }
}
</script>
<template>
  <section class="trial-editor" aria-label="Temporary comparison">
    <template v-if="!draft">
      <BaseButton variant="secondary" :disabled="!base" @click="start('purchase')"
        >Test a purchase</BaseButton
      >
      <BaseButton variant="secondary" :disabled="!bills.length" @click="start('billDate')"
        >Compare a bill date</BaseButton
      >
    </template>
    <template v-else>
      <h3>{{ draft.kind === 'purchase' ? 'Purchase trial' : 'Bill date trial' }}</h3>
      <p>
        Temporary comparison on the selected {{ decision.store.mode }} assumptions. Nothing is
        saved.
      </p>
      <template v-if="draft.kind === 'purchase'">
        <label>Name <input v-model="draft.name" /></label>
        <label>Amount <input v-model="amount" inputmode="decimal" /></label>
        <label
          >Currency
          <select v-model="draft.currency">
            <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
          </select></label
        >
        <label
          >Paying account
          <select v-model="draft.accountId">
            <option
              v-for="a in base?.accounts.filter((a) => a.include_in_total && !a.archived)"
              :key="a.id"
              :value="a.id"
            >
              {{ decision.accountNames.value.get(a.id) ?? a.id }}
            </option>
          </select></label
        >
      </template>
      <label v-else
        >Bill
        <select
          :value="draft.occurrenceKey"
          @change="selectBill(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="b in bills" :key="b.expected.key" :value="b.expected.key">
            {{ b.expected.label }} · {{ b.postponedDate ?? b.expected.date }}
          </option>
        </select></label
      >
      <label
        >Date <input v-model="draft.date" type="date" :min="base?.todayKey" :max="base?.range.to"
      /></label>
      <template v-if="draft.kind === 'purchase' && base">
        <p>
          Allowance-covered {{ formatMoney(covered, base.reportingCurrency) }}; additional
          {{
            converted === undefined
              ? 'unknown until FX is available'
              : formatMoney(Math.max(0, converted - covered), base.reportingCurrency)
          }}.
        </p>
        <details>
          <summary>Use part of a dated everyday allowance</summary>
          <p>
            Choose exactly which future allowance is moved to this purchase. Earlier spending can
            still breach your reserve.
          </p>
          <label
            >Allowance date
            <select v-model="allowanceDate">
              <option value="">Choose date</option>
              <option v-for="[date, available] in forward" :key="date" :value="date">
                {{ date }} · {{ formatMoney(available, base.reportingCurrency) }}
              </option>
            </select></label
          >
          <label
            >Covered amount ({{ base.reportingCurrency }})
            <input v-model="allowanceAmount" inputmode="decimal"
          /></label>
          <BaseButton variant="secondary" @click="allocate">Set allocation</BaseButton>
          <p v-for="a in draft.allocations" :key="a.date">
            {{ a.date }}: {{ formatMoney(a.amountMinor, base.reportingCurrency) }}
            <button
              type="button"
              @click="draft.allocations = draft.allocations.filter((row) => row.date !== a.date)"
            >
              Remove
            </button>
          </p>
        </details>
      </template>
      <p v-if="localError" role="alert">{{ localError }}</p>
      <p v-if="draft.kind === 'purchase'">
        Recording opens Pocket for final review. Allowance allocations stay temporary; choose
        whether the whole expense counts toward your everyday limit there. Review its paying account
        in Horizon after recording.
      </p>
      <BaseButton
        :disabled="!decision.ready.value || (draft.kind === 'billDate' && !persistedBill)"
        @click="record"
        >{{ draft.kind === 'purchase' ? 'Record in Pocket' : 'Review date change' }}</BaseButton
      >
      <BaseButton variant="secondary" @click="review">Review against latest inputs</BaseButton>
      <BaseButton variant="secondary" @click="decision.trialStore.reset()"
        >Dismiss trial</BaseButton
      >
    </template>
  </section>
</template>
<style scoped>
.trial-editor {
  margin-block: var(--kapa-space-4);
  border-block: 1px solid var(--kapa-neutral-400);
  padding-block: var(--kapa-space-3);
}
label {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
  margin-block: var(--kapa-space-3);
}
input,
select {
  min-height: 44px;
  max-width: 100%;
  min-width: 0;
  padding: var(--kapa-space-2);
  font: inherit;
  background: var(--kapa-bg);
  color: var(--kapa-ink);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-sm);
}
button {
  max-width: calc(100% - 8px);
  white-space: normal;
  overflow-wrap: anywhere;
  margin: var(--kapa-space-1);
  min-height: 44px;
}
summary {
  min-height: 44px;
  cursor: pointer;
}
</style>
