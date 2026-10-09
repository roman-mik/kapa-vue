<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { occurrenceFingerprint } from '@roman-mik/kapa-core/horizon';
import type { CashflowDecision } from '@/composables/useCashflowDecision';
import BaseButton from '@/components/ui/BaseButton.vue';
import { formatMoney } from '@/lib/money';
const props = defineProps<{ decision: CashflowDecision }>();
const selected = ref('');
const amount = ref('');
const date = ref('');
const reason = ref('');
const fingerprint = ref('');
const formError = ref('');
const dailyAmount = ref('');
const dailyReason = ref('');
const candidate = computed(() =>
  props.decision.candidates.value.find((o) => o.expected.key === selected.value)
);
const currency = computed(() => props.decision.input.value?.reportingCurrency ?? 'RSD');
watch(selected, () => {
  const o = candidate.value;
  if (!o) return;
  fingerprint.value = occurrenceFingerprint(o);
  amount.value = String(
    Math.abs(o.expected.amountMinor) / 10 ** CURRENCY_EXPONENT[o.expected.currency as Currency]
  );
  date.value = o.postponedDate ?? o.expected.date;
  reason.value = '';
  formError.value = '';
});
watch(
  () => props.decision.store.scope,
  () => {
    selected.value = '';
    amount.value = '';
    reason.value = '';
    date.value = '';
    dailyAmount.value = '';
    dailyReason.value = '';
  }
);
function minor(text: string, c: Currency) {
  const exponent = CURRENCY_EXPONENT[c];
  const n = Math.round(Number(text) * 10 ** exponent);
  if (
    !/^\d+(\.\d+)?$/.test(text) ||
    (text.split('.')[1]?.length ?? 0) > exponent ||
    !Number.isSafeInteger(n) ||
    n < 0
  )
    throw new Error('Enter a nonnegative amount with valid decimal places.');
  return n;
}
function addChange() {
  const o = candidate.value;
  if (!o) return;
  try {
    if (
      !reason.value.trim() ||
      !date.value ||
      date.value < (props.decision.input.value?.todayKey ?? '')
    )
      throw new Error('Enter a future date and a reason.');
    const change = {
      occurrenceKey: o.expected.key,
      fingerprint: fingerprint.value,
      amountMinor: minor(amount.value, o.expected.currency as Currency),
      date: date.value,
      reason: reason.value.trim(),
    };
    const draft = props.decision.store.draft;
    props.decision.store.draft = {
      ...draft,
      changes: [...draft.changes.filter((c) => c.occurrenceKey !== change.occurrenceKey), change],
    };
    formError.value = '';
  } catch (err) {
    formError.value = (err as Error).message;
  }
}
function setDaily() {
  try {
    if (!dailyReason.value.trim())
      throw new Error('Explain the changed daily spending assumption.');
    props.decision.store.draft = {
      ...props.decision.store.draft,
      dailySpend: {
        amountMinor: minor(dailyAmount.value, currency.value),
        reason: dailyReason.value.trim(),
      },
    };
    formError.value = '';
  } catch (err) {
    formError.value = (err as Error).message;
  }
}
function remove(key: string) {
  props.decision.store.draft = {
    ...props.decision.store.draft,
    changes: props.decision.store.draft.changes.filter((c) => c.occurrenceKey !== key),
  };
}
function label(key: string) {
  return (
    props.decision.candidates.value.find((o) => o.expected.key === key)?.expected.label ??
    'Payment no longer available'
  );
}
function before(key: string) {
  const o = props.decision.candidates.value.find((o) => o.expected.key === key);
  return o
    ? `${formatMoney(Math.abs(o.expected.amountMinor), o.expected.currency as Currency)} on ${o.postponedDate ?? o.expected.date}`
    : 'Unavailable';
}
function nativeCurrency(key: string): Currency {
  return (props.decision.candidates.value.find((o) => o.expected.key === key)?.expected.currency ??
    currency.value) as Currency;
}
</script>
<template>
  <section class="cautious-editor" aria-label="Forecast assumptions">
    <div class="modes" role="group" aria-label="Scenario">
      <BaseButton
        type="button"
        :aria-pressed="decision.store.mode === 'expected'"
        @click="decision.store.mode = 'expected'"
        >Expected</BaseButton
      >
      <BaseButton
        type="button"
        :aria-pressed="decision.store.mode === 'cautious'"
        @click="decision.store.mode = 'cautious'"
        >Cautious</BaseButton
      >
    </div>
    <template v-if="decision.store.mode === 'cautious'">
      <p v-if="!decision.store.draft.changes.length && !decision.store.draft.dailySpend">
        Same assumptions as expected.
      </p>
      <p>
        Temporary changes only. Increasing income or reducing expenses does not inherently make a
        forecast cautious. Dates model the configured same-day order, not bank timestamps.
      </p>
      <details>
        <summary>Change cautious assumptions</summary>
        <form @submit.prevent="addChange">
          <label
            >Future payment
            <select v-model="selected">
              <option value="">Choose a payment</option>
              <option
                v-for="o in decision.candidates.value"
                :key="o.expected.key"
                :value="o.expected.key"
              >
                {{ o.expected.label }} · {{ o.postponedDate ?? o.expected.date }}
              </option>
            </select></label
          >
          <template v-if="candidate">
            <p>Expected: {{ before(selected) }}</p>
            <label
              >Trial amount ({{ candidate.expected.currency }})
              <input v-model="amount" inputmode="decimal" required
            /></label>
            <label
              >Trial date
              <input v-model="date" type="date" :min="decision.input.value?.todayKey" required
            /></label>
            <label>Reason <input v-model="reason" required /></label>
            <BaseButton type="submit">Apply temporary payment change</BaseButton>
          </template>
        </form>
        <form @submit.prevent="setDaily">
          <label
            >Trial daily everyday spending ({{ currency }})
            <input v-model="dailyAmount" inputmode="decimal" required
          /></label>
          <label>Spending reason <input v-model="dailyReason" required /></label>
          <BaseButton type="submit">Apply daily spending assumption</BaseButton>
        </form>
      </details>
      <p v-if="formError" role="alert">{{ formError }}</p>
      <ul v-if="decision.store.draft.changes.length">
        <li v-for="c in decision.store.draft.changes" :key="c.occurrenceKey">
          {{ label(c.occurrenceKey) }}: {{ before(c.occurrenceKey) }} →
          {{ formatMoney(c.amountMinor, nativeCurrency(c.occurrenceKey)) }} on {{ c.date }}.
          {{ c.reason }}
          <BaseButton
            v-if="
              decision.staleChanges.value.some((s) => s.occurrenceKey === c.occurrenceKey) &&
              decision.candidates.value.some((o) => o.expected.key === c.occurrenceKey)
            "
            type="button"
            variant="secondary"
            @click="decision.reviewChange(c.occurrenceKey)"
            >Use changed payment as baseline</BaseButton
          >
          <BaseButton type="button" variant="secondary" @click="remove(c.occurrenceKey)"
            >Remove change</BaseButton
          >
        </li>
      </ul>
      <p v-if="decision.store.draft.dailySpend">
        Expected spending: current
        {{ decision.input.value?.assessment?.provenance.spendMode }} assumption →
        {{ formatMoney(decision.store.draft.dailySpend.amountMinor, currency) }} each day.
        {{ decision.store.draft.dailySpend.reason }}
      </p>
      <BaseButton
        v-if="decision.store.draft.dailySpend"
        type="button"
        variant="secondary"
        @click="decision.store.draft = { ...decision.store.draft, dailySpend: null }"
        >Remove spending change</BaseButton
      >
      <BaseButton type="button" variant="secondary" @click="decision.store.reset()"
        >Dismiss all trial changes</BaseButton
      >
    </template>
  </section>
</template>
<style scoped>
.cautious-editor {
  overflow-wrap: anywhere;
}
.modes {
  display: flex;
  gap: var(--kapa-space-2);
  flex-wrap: wrap;
}
label {
  display: block;
  margin-block: var(--kapa-space-3);
}
input,
select {
  display: block;
  min-height: 44px;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  border: 1px solid var(--kapa-neutral-400);
  padding: var(--kapa-space-2);
}
summary {
  cursor: pointer;
  min-height: 44px;
}
form {
  padding-block: var(--kapa-space-3);
}
button {
  margin-block: var(--kapa-space-2);
}
input:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--kapa-ink);
  outline-offset: 2px;
}
</style>
