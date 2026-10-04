<script setup lang="ts">
import { computed, ref, shallowRef, watch, onUnmounted } from 'vue';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { CURRENCY_EXPONENT, zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import { usePaymentTracking, type PaymentContext } from '@/composables/usePaymentTracking';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
import BaseSheet from '@/components/ui/BaseSheet.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
const sheet = usePaymentLinkSheet();
const space = useSpaceStore();
// Instantiate remote reads only while the sheet is mounted by App.
const tracking = usePaymentTracking();
const snapshot = shallowRef<PaymentContext | null>(null);
const expense = shallowRef<ExpenseView | null>(sheet.expense.value);
const expenseId = ref(sheet.expense.value?.id ?? '');
const paymentId = ref(sheet.paymentId.value ?? '');
const accountId = ref('');
const inclusion = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const saved = ref(false);
const requestId = ref(crypto.randomUUID());
const refreshSaved = shallowRef<(() => Promise<void>) | null>(null);
const checking = ref(false);
const amounts = ref<Record<string, string>>({});
const includedExpenses = ref<string[]>([]);
const includedPayments = ref<string[]>([]);
const checkedToday = ref(false);
const search = ref('');
const origin = space.currentSpaceId;
const originUser = useSessionStore().user?.id;
let mounted = true;
onUnmounted(() => {
  mounted = false;
});
const isCurrent = () =>
  mounted && origin === space.currentSpaceId && originUser === useSessionStore().user?.id;
const allowanceRequestId = ref(crypto.randomUUID());
const timezone = space.currentSpace?.timezone ?? 'UTC';
const cashAccounts = computed(
  () => snapshot.value?.accounts.filter((a) => !a.archived && a.include_in_total) ?? []
);
const completedInCashAccounts = computed(
  () =>
    snapshot.value?.occurrences.filter(
      (p) =>
        p.state === 'completed' &&
        p.actual &&
        cashAccounts.value.some((a) => a.id === p.actual!.accountId)
    ) ?? []
);
const selectedPayment = computed(() =>
  snapshot.value?.occurrences.find((p) => p.id === paymentId.value)
);
const expenseDate = computed(() =>
  expense.value?.spent_at ? zonedDateKey(new Date(expense.value.spent_at), timezone) : ''
);
const eligibleExpenses = computed(
  () =>
    snapshot.value?.expenses.filter(
      (e) =>
        e.id &&
        e.updated_at &&
        (e.amount_minor ?? 0) > 0 &&
        e.spent_at &&
        zonedDateKey(new Date(e.spent_at), timezone) <= snapshot.value!.today
    ) ?? []
);
const payments = computed(
  () =>
    snapshot.value?.occurrences.filter(
      (p) =>
        ['expected', 'postponed', 'completed'].includes(p.state) &&
        ['obligation', 'oneOffOut'].includes(p.expected.kind) &&
        p.expected.amountMinor < 0 &&
        p.expected.label.toLowerCase().includes(search.value.toLowerCase()) &&
        !snapshot.value!.coverage.some(
          (c) => c.occurrenceId === p.id && c.expenseId !== expense.value?.id
        )
    ) ?? []
);
const accounts = computed(
  () =>
    snapshot.value?.accounts.filter(
      (a) =>
        !a.archived &&
        a.currency === expense.value?.currency &&
        (a.include_in_total || snapshot.value!.observations.some((o) => o.accountId === a.id))
    ) ?? []
);
const observation = computed(() =>
  snapshot.value?.observations.find((o) => o.accountId === accountId.value)
);
const existingCoverage = computed(() =>
  snapshot.value?.coverage.find((c) => c.expenseId === expense.value?.id)
);
const mismatch = computed(() => {
  const actual = selectedPayment.value?.actual;
  if (!actual) return null;
  if (
    actual.amountMinor !== -(expense.value?.amount_minor ?? 0) ||
    actual.currency !== expense.value?.currency ||
    actual.date !== expenseDate.value ||
    actual.accountId !== accountId.value
  )
    return 'This completed payment has different actual details. Correct or review it before linking.';
  if (actual.observationId !== observation.value?.id || actual.inclusion !== inclusion.value)
    return 'This completed payment has different balance inclusion. Review it before linking.';
  return null;
});
const alreadyLinked = computed(
  () => existingCoverage.value?.occurrenceId === paymentId.value && !!paymentId.value
);
const otherLink = computed(
  () =>
    existingCoverage.value?.occurrenceId && existingCoverage.value.occurrenceId !== paymentId.value
);
const billsSeparate = computed(
  () => (snapshot.value?.allowance?.policy as { mode?: string } | null)?.mode === 'separate'
);
const canAllocate = computed(
  () =>
    !!expense.value?.id &&
    expense.value.space_id === origin &&
    !!expense.value.updated_at &&
    (expense.value.amount_minor ?? 0) > 0 &&
    expenseDate.value <= (snapshot.value?.today ?? '') &&
    !!observation.value &&
    !!inclusion.value &&
    !existingCoverage.value?.occurrenceId &&
    !busy.value &&
    !saved.value
);
const canLink = computed(
  () =>
    !!expense.value?.id &&
    expense.value.space_id === origin &&
    !!expense.value.updated_at &&
    (expense.value.amount_minor ?? 0) > 0 &&
    expenseDate.value <= (snapshot.value?.today ?? '') &&
    !!selectedPayment.value &&
    !!observation.value &&
    !!inclusion.value &&
    !mismatch.value &&
    !otherLink.value &&
    !alreadyLinked.value &&
    !busy.value &&
    !saved.value
);
const spendToCheck = computed(() =>
  eligibleExpenses.value.filter(
    (e) => !snapshot.value?.coverage.some((c) => c.expenseId === e.id && c.occurrenceId)
  )
);
function message(err: unknown) {
  return err && typeof err === 'object' && 'message' in err
    ? String(err.message)
    : 'Could not save. Your choices are preserved.';
}
function hydrate(data: PaymentContext) {
  snapshot.value = data;
  if (!paymentId.value && expense.value?.id)
    paymentId.value =
      data.coverage.find((c) => c.expenseId === expense.value?.id)?.occurrenceId ?? '';
  amounts.value = Object.fromEntries(
    data.accounts.map((a) => [
      a.id,
      (a.current_balance_minor / 10 ** CURRENCY_EXPONENT[a.currency as Currency]).toFixed(
        CURRENCY_EXPONENT[a.currency as Currency]
      ),
    ])
  );
  if (!expense.value && expenseId.value)
    expense.value = data.expenses.find((e) => e.id === expenseId.value) ?? null;
}
watch(
  tracking.context,
  (data) => {
    if (data && !snapshot.value) hydrate(data);
  },
  { immediate: true }
);
watch(
  () => [space.currentSpaceId, useSessionStore().user?.id],
  () => sheet.close(),
  { flush: 'sync' }
);
watch(expenseId, (id) => {
  expense.value =
    snapshot.value?.expenses.find((e) => e.id === id) ??
    (sheet.expense.value?.id === id ? sheet.expense.value : null);
  accountId.value = '';
  inclusion.value = '';
});
watch(accountId, () => {
  inclusion.value = '';
});
watch(paymentId, () => {
  accountId.value =
    selectedPayment.value?.actual?.accountId ?? selectedPayment.value?.expected.accountId ?? '';
  inclusion.value = '';
});
watch(
  [selectedPayment, expense],
  () => {
    if (!accountId.value)
      accountId.value =
        selectedPayment.value?.actual?.accountId ?? selectedPayment.value?.expected.accountId ?? '';
  },
  { immediate: true }
);
async function reload() {
  busy.value = true;
  error.value = null;
  try {
    const data = await tracking.refresh();
    if (tracking.error.value || !data)
      throw new Error(tracking.error.value ?? 'Payment details unavailable.');
    if (!isCurrent()) return;
    hydrate(data);
    if (expense.value?.id) expense.value = await tracking.expenseForReview(expense.value.id);
    inclusion.value = '';
    allowanceRequestId.value = crypto.randomUUID();
    requestId.value = crypto.randomUUID();
  } catch (err) {
    error.value = message(err);
  } finally {
    busy.value = false;
  }
}
async function retryRefresh() {
  busy.value = true;
  error.value = null;
  try {
    await refreshSaved.value?.();
    if (isCurrent()) sheet.close();
  } catch (err) {
    if (isCurrent()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
async function link() {
  if (!canLink.value || !expense.value || !selectedPayment.value || !observation.value) return;
  busy.value = true;
  error.value = null;
  try {
    const e = expense.value;
    const result = await tracking.link(
      {
        expenseId: e.id!,
        expenseUpdatedAt: e.updated_at!,
        revision:
          existingCoverage.value?.revision ??
          snapshot.value?.cutovers.find((c) => c.expenseId === e.id)?.revision ??
          0,
        accountId: accountId.value,
        observationId: observation.value.id,
        inclusion: inclusion.value as 'included' | 'excluded' | 'unknown',
        occurrenceId: selectedPayment.value.id,
        paymentRevision: selectedPayment.value.revision,
      },
      requestId.value
    );
    if (!isCurrent()) return;
    saved.value = true;
    refreshSaved.value = result.refresh;
    await result.refresh();
    if (isCurrent()) sheet.close();
  } catch (err) {
    if (isCurrent()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
async function allocate() {
  if (!canAllocate.value || !expense.value || !observation.value) return;
  busy.value = true;
  error.value = null;
  try {
    const e = expense.value;
    const result = await tracking.allocate(
      {
        expenseId: e.id!,
        expenseUpdatedAt: e.updated_at!,
        revision:
          existingCoverage.value?.revision ??
          snapshot.value?.cutovers.find((c) => c.expenseId === e.id)?.revision ??
          0,
        accountId: accountId.value,
        observationId: observation.value.id,
        inclusion: inclusion.value as 'included' | 'excluded' | 'unknown',
      },
      requestId.value
    );
    if (!isCurrent()) return;
    saved.value = true;
    refreshSaved.value = result.refresh;
    await result.refresh();
    if (isCurrent()) sheet.close();
  } catch (err) {
    if (isCurrent()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
async function separateAllowance() {
  if (!snapshot.value || busy.value || saved.value) return;
  busy.value = true;
  error.value = null;
  try {
    const result = await tracking.separateAllowance(snapshot.value, allowanceRequestId.value);
    if (!isCurrent()) return;
    saved.value = true;
    refreshSaved.value = async () => {
      await result.refresh();
      if (tracking.context.value) hydrate(tracking.context.value);
      saved.value = false;
      requestId.value = crypto.randomUUID();
    };
    await refreshSaved.value();
  } catch (err) {
    if (isCurrent()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
async function checkBalances() {
  if (!snapshot.value || !checkedToday.value || busy.value || saved.value) return;
  busy.value = true;
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
    const result = await tracking.checkBalances({
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
    if (!isCurrent()) return;
    saved.value = true;
    refreshSaved.value = async () => {
      await result.refresh();
      if (tracking.context.value) hydrate(tracking.context.value);
      checking.value = false;
      saved.value = false;
      requestId.value = crypto.randomUUID();
    };
    await refreshSaved.value();
  } catch (err) {
    if (isCurrent()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <BaseSheet
    :open="sheet.isOpen.value"
    labelled-by="payment-link-title"
    :dismissible="!busy"
    @close="sheet.close"
  >
    <div class="payment-flow">
      <h2 id="payment-link-title" tabindex="-1" data-autofocus>
        {{ checking || !snapshot?.state ? 'Check balances' : 'Link to a planned payment' }}
      </h2>
      <p v-if="!snapshot && tracking.loading.value" role="status">Loading payment details…</p>
      <p v-if="error || tracking.error.value" role="alert">{{ error ?? tracking.error.value }}</p>
      <template v-if="saved">
        <p role="status">Saved. Retry refresh to load your changes without saving again.</p>
        <BaseButton :disabled="busy" @click="retryRefresh">Retry refresh</BaseButton>
      </template>
      <BaseButton v-else-if="!snapshot" variant="secondary" :disabled="busy" @click="reload"
        >Reload details</BaseButton
      >
      <form
        v-else-if="checking || !snapshot.state"
        class="flow-form"
        @submit.prevent="checkBalances"
      >
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
          @click="sheet.close"
          >Add account</router-link
        >
        <fieldset v-if="spendToCheck.length">
          <legend>Recorded expenses already included in these balances</legend>
          <p>
            Select only spending your bank balances already contain. Other spending will need
            review.
          </p>
          <label v-for="e in spendToCheck" :key="e.id!" class="choice"
            ><input v-model="includedExpenses" type="checkbox" :value="e.id" :disabled="busy" />{{
              e.note || 'Expense'
            }}
            · {{ formatMoney(e.amount_minor ?? 0, e.currency as Currency) }} ·
            {{
              e.spent_at ? formatFullDate(zonedDateKey(new Date(e.spent_at), timezone)) : ''
            }}</label
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
        <BaseButton type="submit" :disabled="busy || !checkedToday || !cashAccounts.length">{{
          snapshot.state ? 'Save checked balances' : 'Save balances and start tracking'
        }}</BaseButton>
      </form>
      <form v-else class="flow-form" @submit.prevent="link">
        <p>
          The Pocket expense stays in your history. Linking completes only the selected payment;
          later recurring payments stay scheduled.
        </p>
        <label for="link-expense"
          >Recorded Pocket expense
          <BaseSelect
            id="link-expense"
            v-model="expenseId"
            :disabled="busy || !!sheet.expense.value"
            required
            ><option value="">Choose an expense</option>
            <option v-if="sheet.expense.value" :value="sheet.expense.value.id!">
              {{ expense?.note || 'Expense' }} ·
              {{ formatMoney(expense?.amount_minor ?? 0, expense?.currency as Currency) }}
            </option>
            <option
              v-for="e in eligibleExpenses.filter((e) => e.id !== sheet.expense.value?.id)"
              :key="e.id!"
              :value="e.id!"
            >
              {{ e.note || 'Expense' }} ·
              {{ formatMoney(e.amount_minor ?? 0, e.currency as Currency) }} ·
              {{ e.spent_at ? formatFullDate(zonedDateKey(new Date(e.spent_at), timezone)) : '' }}
            </option></BaseSelect
          >
        </label>
        <label for="payment-search"
          >Find a bill or dated payment<BaseInput
            id="payment-search"
            v-model="search"
            type="search"
            :disabled="busy"
        /></label>
        <label for="link-payment"
          >Planned payment<BaseSelect
            id="link-payment"
            v-model="paymentId"
            required
            :disabled="busy"
            ><option value="">Choose a payment</option>
            <option v-for="p in payments" :key="p.id" :value="p.id">
              {{ p.expected.label }} · {{ p.postponedDate ?? p.expected.date
              }}{{
                p.state !== 'completed' && (p.postponedDate ?? p.expected.date) < snapshot.today
                  ? ' · overdue'
                  : ''
              }}{{ p.state === 'completed' ? ' · completed' : '' }}
            </option></BaseSelect
          ></label
        >
        <p v-if="!payments.length">
          No available bills or dated payments. Spending-rate estimates cannot be completed.
        </p>
        <dl v-if="selectedPayment && expense" class="comparison">
          <dt>Expected</dt>
          <dd>
            {{
              formatMoney(
                -selectedPayment.expected.amountMinor,
                selectedPayment.expected.currency as Currency
              )
            }}
            · {{ formatFullDate(selectedPayment.expected.originalDate) }}
          </dd>
          <dt>Recorded</dt>
          <dd>
            {{ formatMoney(expense.amount_minor ?? 0, expense.currency as Currency) }} ·
            {{ formatFullDate(expenseDate) }}
          </dd>
        </dl>
        <label for="link-account"
          >Paid from<BaseSelect id="link-account" v-model="accountId" required :disabled="busy"
            ><option value="">Choose account</option>
            <option v-for="a in accounts" :key="a.id" :value="a.id">
              {{ a.name }} ({{ a.currency }})
            </option></BaseSelect
          ></label
        >
        <p v-if="expense && !accounts.length">
          Add an included account in {{ expense.currency }} to record where this payment came from.
        </p>
        <fieldset v-if="observation">
          <legend>Does the checked balance already include this expense?</legend>
          <p>
            Checked {{ formatFullDate(observation.date) }}:
            {{ formatMoney(observation.balanceMinor, observation.currency as Currency) }}
          </p>
          <label class="choice"
            ><input
              v-model="inclusion"
              type="radio"
              value="included"
              :disabled="busy || expenseDate > observation.date"
            />Included — no new cash deduction</label
          >
          <label class="choice"
            ><input v-model="inclusion" type="radio" value="excluded" :disabled="busy" />Not
            included — deduct the recorded amount</label
          >
          <label class="choice"
            ><input v-model="inclusion" type="radio" value="unknown" :disabled="busy" />Not sure —
            mark the estimate for review</label
          >
        </fieldset>
        <p v-else-if="accountId">Check this account balance before linking.</p>
        <p v-if="mismatch || otherLink || alreadyLinked" role="status">
          {{
            alreadyLinked
              ? 'This expense is already linked to this payment.'
              : (mismatch ?? 'This expense is linked to another payment. Review that link first.')
          }}
        </p>
        <p v-if="inclusion === 'unknown'">
          Your forecast will need balance review before it can give a reliable answer.
        </p>
        <p v-if="selectedPayment?.postponedDate">
          Postponed to {{ formatFullDate(selectedPayment.postponedDate) }}. The recorded date above
          will be used.
        </p>
        <BaseButton type="submit" :disabled="!canLink">{{
          selectedPayment?.state === 'completed'
            ? 'Link recorded expense'
            : 'Complete and link payment'
        }}</BaseButton>
        <template v-if="!paymentId && !existingCoverage?.occurrenceId">
          <p>
            No planned payment for this expense? Save its account and balance inclusion without
            completing a payment.
          </p>
          <BaseButton variant="secondary" :disabled="!canAllocate" @click="allocate"
            >Save cash movement only</BaseButton
          >
        </template>
        <BaseButton variant="secondary" :disabled="busy" @click="checking = true"
          >Check balances</BaseButton
        >
        <BaseButton variant="secondary" :disabled="busy" @click="reload"
          >Reload and review latest details</BaseButton
        >
      </form>
      <section
        v-if="snapshot?.state && !checking && !saved && !billsSeparate"
        class="flow-form"
        aria-label="Everyday allowance and bills"
      >
        <p>
          If your everyday allowance excludes scheduled bills, Horizon should project both
          separately. This does not change your Pocket cap.
        </p>
        <BaseButton variant="secondary" :disabled="busy" @click="separateAllowance"
          >Confirm bills are separate from everyday allowance</BaseButton
        >
      </section>
      <BaseButton variant="ghost" :disabled="busy" @click="sheet.close">Close</BaseButton>
    </div>
  </BaseSheet>
</template>
<style scoped>
.payment-flow,
.flow-form {
  display: grid;
  gap: var(--kapa-space-4);
}
h2,
p {
  margin: 0;
}
label {
  display: grid;
  gap: var(--kapa-space-2);
}
fieldset {
  margin: 0;
  min-width: 0;
  padding: var(--kapa-space-3);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-sm);
}
legend {
  font-weight: 600;
}
.choice {
  display: flex;
  align-items: center;
  min-height: 44px;
  gap: var(--kapa-space-3);
}
.choice input {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  accent-color: var(--kapa-accent);
}
.comparison {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--kapa-space-2);
  margin: 0;
  background: var(--kapa-surface);
  padding: var(--kapa-space-3);
}
dd {
  margin: 0;
  text-align: right;
}
.payment-flow {
  overflow-wrap: anywhere;
}
:deep(.select),
:deep(.input) {
  min-width: 0;
  width: 100%;
  box-sizing: border-box;
}
</style>
