<script setup lang="ts">
import { useHorizonClock } from '@/composables/useHorizonClock';
import { computed, ref, watch } from 'vue';
import { CURRENCY_EXPONENT, zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import type { CashDecision, PaymentContext } from '@/composables/usePaymentTracking';
import { useSpaceStore } from '@/stores/space';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
const props = defineProps<{ context: PaymentContext; busy: boolean }>();
const emit = defineEmits<{ submit: [decision: CashDecision]; close: [] }>();
const clock = useHorizonClock();
const staleDate = computed(() => props.context.today !== clock.today.value);
const snapshot = computed(() => props.context);
const timezone = useSpaceStore().currentSpace?.timezone ?? 'UTC';
const amounts = ref<Record<string, string>>({});
const includedExpenses = ref<string[]>([]);
const includedPayments = ref<string[]>([]);
const checkedToday = ref(false);
const requestId = ref(crypto.randomUUID());
const error = ref<string | null>(null);
const cashAccounts = computed(() =>
  props.context.accounts.filter((a) => !a.archived && a.include_in_total)
);
const completedInCashAccounts = computed(() =>
  props.context.occurrences.filter(
    (p) =>
      p.state === 'completed' &&
      p.actual &&
      cashAccounts.value.some((a) => a.id === p.actual!.accountId)
  )
);
const spendToCheck = computed(() =>
  props.context.expenses.filter(
    (e) =>
      e.id &&
      e.updated_at &&
      e.spent_at &&
      (e.amount_minor ?? 0) > 0 &&
      zonedDateKey(new Date(e.spent_at), timezone) <= props.context.today &&
      !props.context.coverage.some((c) => c.expenseId === e.id && c.occurrenceId)
  )
);
watch(
  () => props.context,
  (data) => {
    amounts.value = Object.fromEntries(
      data.accounts.map((a) => [
        a.id,
        (a.current_balance_minor / 10 ** CURRENCY_EXPONENT[a.currency as Currency]).toFixed(
          CURRENCY_EXPONENT[a.currency as Currency]
        ),
      ])
    );
    includedExpenses.value = [];
    includedPayments.value = [];
    checkedToday.value = false;
    requestId.value = crypto.randomUUID();
  },
  { immediate: true }
);
function submit() {
  if (!checkedToday.value || staleDate.value || props.busy || !cashAccounts.value.length) return;
  error.value = null;
  try {
    const checks = cashAccounts.value.map((a) => {
      const text = amounts.value[a.id]?.trim() ?? '';
      const balanceMinor = Number(text) * 10 ** CURRENCY_EXPONENT[a.currency as Currency];
      if (
        !/^-?\d+(?:\.\d+)?$/.test(text) ||
        !Number.isFinite(balanceMinor) ||
        !Number.isSafeInteger(Math.round(balanceMinor)) ||
        Math.abs(balanceMinor - Math.round(balanceMinor)) > 0.000001
      )
        throw new Error('Enter a valid checked balance for every account.');
      return {
        accountId: a.id,
        currency: a.currency,
        balanceMinor: Math.round(balanceMinor),
        previousBalanceMinor: a.current_balance_minor,
        observationId: snapshot.value!.observations.find((o) => o.accountId === a.id)?.id ?? null,
        includedPaymentIds: snapshot
          .value!.occurrences.filter(
            (p) => p.actual?.accountId === a.id && includedPayments.value.includes(p.id)
          )
          .map((p) => p.id),
      };
    });
    emit('submit', {
      checks,
      expenses: spendToCheck.value
        .filter((e) => includedExpenses.value.includes(e.id!))
        .map((e) => ({
          expenseId: e.id!,
          expenseUpdatedAt: e.updated_at!,
          revision:
            snapshot.value!.coverage.find((c) => c.expenseId === e.id)?.revision ??
            snapshot.value!.cutovers.find((c) => c.expenseId === e.id)?.revision ??
            0,
        })),
      sourceRevision: snapshot.value.state?.revision ?? null,
      cashRevision: snapshot.value.state?.cash_revision ?? null,
      requestId: requestId.value,
    });
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Review the balances before saving.';
  }
}
</script>
<template>
  <p v-if="staleDate" role="alert">The date changed. Reload balances before checking them.</p>
  <p v-if="error" role="alert">{{ error }}</p>
  <form class="flow-form" @submit.prevent="submit">
    <p>
      Check the money in every included account today. Future estimates will start from these
      balances.
    </p>
    <label v-for="a in cashAccounts" :key="a.id" :for="`checked-${a.id}`"
      >{{ a.name }} ({{ a.currency }})
      <BaseInput
        :id="`checked-${a.id}`"
        v-model="amounts[a.id]"
        inputmode="decimal"
        required
        :disabled="busy"
      />
    </label>
    <p v-if="!cashAccounts.length">Add an included account before checking balances.</p>
    <router-link
      v-if="!cashAccounts.length"
      :to="{ name: 'horizon-accounts' }"
      @click="emit('close')"
      >Add account</router-link
    >
    <fieldset v-if="spendToCheck.length">
      <legend>Recorded expenses already included in these balances</legend>
      <p>
        Select only spending your bank balances already contain. Other spending will need review.
      </p>
      <label v-for="e in spendToCheck" :key="e.id!" class="choice"
        ><input v-model="includedExpenses" type="checkbox" :value="e.id" :disabled="busy" />{{
          e.note || 'Expense'
        }}
        · {{ formatMoney(e.amount_minor ?? 0, e.currency as Currency) }} ·
        {{ e.spent_at ? formatFullDate(zonedDateKey(new Date(e.spent_at), timezone)) : '' }}</label
      >
    </fieldset>
    <fieldset v-if="completedInCashAccounts.length">
      <legend>Completed payments included in these balances</legend>
      <label v-for="p in completedInCashAccounts" :key="p.id" class="choice"
        ><input v-model="includedPayments" type="checkbox" :value="p.id" :disabled="busy" />{{
          p.expected.label
        }}
        · {{ formatMoney(p.actual!.amountMinor, p.actual!.currency as Currency) }}</label
      >
    </fieldset>
    <label class="choice"
      ><input v-model="checkedToday" type="checkbox" :disabled="busy" />I checked these account
      balances today</label
    >
    <BaseButton
      type="submit"
      :disabled="busy || staleDate || !checkedToday || !cashAccounts.length"
      >{{
        snapshot.state ? 'Save checked balances' : 'Save balances and start tracking'
      }}</BaseButton
    >
  </form>
</template>
<style scoped>
.flow-form {
  display: grid;
  gap: var(--kapa-space-3);
}
label {
  display: grid;
  gap: var(--kapa-space-2);
}
.choice {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: var(--kapa-space-2);
}
.choice input {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
}
fieldset {
  min-width: 0;
  border: 1px solid var(--kapa-neutral-400);
  padding: var(--kapa-space-3);
  border-radius: var(--kapa-radius-md);
}
</style>
