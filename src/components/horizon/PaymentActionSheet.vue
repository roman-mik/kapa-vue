<script setup lang="ts">
import { useHorizonClock } from '@/composables/useHorizonClock';
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  buildProjection,
  occurrenceFingerprint,
  transitionOccurrence,
  type OccurrenceAction,
} from '@roman-mik/kapa-core/horizon';
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { usePaymentActions } from '@/composables/usePaymentActions';
import { usePaymentActionSheet } from '@/composables/usePaymentActionSheet';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import type { PaymentContext } from '@/composables/usePaymentTracking';
import BaseSheet from '@/components/ui/BaseSheet.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
const clock = useHorizonClock();
const staleDate = computed(() => !!snapshot.value && snapshot.value.today !== clock.today.value);
const sheet = usePaymentActionSheet();
const selectedId = sheet.paymentId.value!;
const initialDateTrial = sheet.dateTrial.value;
const space = useSpaceStore();
const session = useSessionStore();
const origin = space.currentSpaceId;
const originUser = session.user?.id;
let mounted = true;
onUnmounted(() => {
  mounted = false;
});
const current = () => mounted && space.currentSpaceId === origin && session.user?.id === originUser;
const actions = usePaymentActions(() => selectedId);
const snapshot = shallowRef<PaymentContext | null>(null);
const payment = computed(() => snapshot.value?.occurrences.find((p) => p.id === selectedId));
const mode = ref<OccurrenceAction['kind'] | 'undo' | null>(null);
const amount = ref('');
const date = ref('');
const accountId = ref('');
const inclusion = ref('');
const requestId = ref(crypto.randomUUID());
const busy = ref(false);
const error = ref<string | null>(null);
const savedRefresh = shallowRef<(() => Promise<void>) | null>(null);
const saved = computed(() => !!savedRefresh.value);
const linked = computed(() => snapshot.value?.coverage.find((c) => c.occurrenceId === selectedId));
const accounts = computed(() => snapshot.value?.accounts.filter((a) => !a.archived) ?? []);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value));
const observation = computed(() =>
  snapshot.value?.observations.find((o) => o.accountId === accountId.value)
);
const unresolved = computed(
  () => payment.value && ['expected', 'postponed'].includes(payment.value.state)
);
const outgoing = computed(() => (payment.value?.expected.amountMinor ?? 0) < 0);
const stateLabel = computed(() => {
  const p = payment.value;
  if (!p) return '';
  if (p.state === 'expected' && p.expected.date < (snapshot.value?.today ?? '')) return 'Overdue';
  return {
    expected: 'Expected',
    postponed: 'Postponed',
    completed: outgoing.value ? 'Paid' : 'Received',
    cancelled: 'Cancelled',
  }[p.state];
});
function hydrate(data: PaymentContext) {
  snapshot.value = data;
  const p = payment.value;
  if (!p) return;
  accountId.value = p.actual?.accountId ?? p.expected.accountId;
  const exponent = CURRENCY_EXPONENT[(p.actual?.currency ?? p.expected.currency) as Currency];
  amount.value = (
    Math.abs(p.actual?.amountMinor ?? p.expected.amountMinor) /
    10 ** exponent
  ).toFixed(exponent);
  date.value = p.actual?.date ?? data.today;
  inclusion.value = '';
  if (initialDateTrial) {
    if (occurrenceFingerprint(p) !== initialDateTrial.fingerprint) {
      error.value =
        'This bill changed since the trial. Review its latest details before changing the date.';
    } else if (['expected', 'postponed'].includes(p.state)) {
      mode.value = 'postpone';
      date.value = initialDateTrial.date;
    }
  }
}
watch(
  actions.tracking.context,
  (data) => {
    if (data && !snapshot.value) hydrate(data);
  },
  { immediate: true }
);
watch(
  () => [space.currentSpaceId, session.user?.id],
  () => sheet.close(),
  { flush: 'sync' }
);
watch(accountId, (id, previous) => {
  inclusion.value = '';
  const oldCurrency = accounts.value.find((a) => a.id === previous)?.currency;
  if (oldCurrency && oldCurrency !== accounts.value.find((a) => a.id === id)?.currency)
    amount.value = '';
});
const latest = computed(() => actions.latest.value);
const retired = computed(
  () => (latest.value?.command as { kind?: string } | undefined)?.kind === 'sourceRetire'
);
const undoAvailable = computed(() => {
  const last = latest.value;
  if (!last || linked.value || retired.value) return false;
  const after = last.after_value as { revision?: number };
  const before = last.before_value as {
    actual?: { accountId: string; observationId: string | null } | null;
  };
  const command = last.command as { action?: { kind?: string } };
  const permitted = ['complete', 'correct', 'cancel', 'postpone', 'reopen', 'undo'].includes(
    command.action?.kind ?? ''
  );
  const priorActual = before.actual;
  const priorObservation =
    snapshot.value?.observations.find((o) => o.accountId === priorActual?.accountId)?.id ?? null;
  return (
    permitted &&
    after.revision === payment.value?.revision &&
    (!priorActual || priorActual.observationId === priorObservation)
  );
});
function choose(next: typeof mode.value) {
  mode.value = next;
  error.value = null;
  requestId.value = crypto.randomUUID();
  inclusion.value = '';
  if (next === 'postpone')
    date.value =
      payment.value?.postponedDate && payment.value.postponedDate >= snapshot.value!.today
        ? payment.value.postponedDate
        : snapshot.value!.today;
}
const command = computed<OccurrenceAction | null>(() => {
  if (!mode.value || !payment.value || !snapshot.value || mode.value === 'undo') return null;
  if (mode.value === 'postpone') return { kind: 'postpone', date: date.value };
  if (mode.value === 'cancel' || mode.value === 'reopen') return { kind: mode.value };
  if (!account.value || !inclusion.value) return null;
  const text = amount.value.trim();
  const minor = Number(text) * 10 ** CURRENCY_EXPONENT[account.value.currency as Currency];
  if (
    !/^\d+(?:\.\d+)?$/.test(text) ||
    minor <= 0 ||
    !Number.isSafeInteger(Math.round(minor)) ||
    Math.abs(minor - Math.round(minor)) > 0.000001
  )
    return null;
  return {
    kind: mode.value,
    actual: {
      amountMinor: Math.round(minor) * Math.sign(payment.value.expected.amountMinor),
      date: date.value,
      accountId: account.value.id,
      currency: account.value.currency,
      observationId: observation.value?.id ?? null,
      inclusion: inclusion.value as 'included' | 'excluded' | 'unknown',
    },
  };
});
const candidate = computed(() => {
  if (!payment.value || !command.value || !snapshot.value) return null;
  try {
    return transitionOccurrence(
      payment.value,
      payment.value.revision,
      command.value,
      snapshot.value.today
    );
  } catch {
    return null;
  }
});
const preview = computed(() => {
  const input = snapshot.value?.projectionInput;
  if (!candidate.value || !input?.lifecycle) return null;
  const result = buildProjection({
    ...input,
    lifecycle: {
      ...input.lifecycle,
      occurrences: input.lifecycle.occurrences.map((p) =>
        p.id === selectedId ? candidate.value! : p
      ),
    },
  });
  if (result.unconverted.length || result.value.lifecycleIssues?.length)
    return { qualified: true, cash: null };
  const today = result.value.days.find((d) => d.date === input.todayKey);
  return {
    qualified: false,
    cash:
      result.value.events.find((e) => e.date === input.todayKey)?.balanceBeforeMinor ??
      today?.balanceMinor ??
      null,
  };
});
async function reload() {
  busy.value = true;
  error.value = null;
  try {
    const data = await actions.tracking.refresh();
    await actions.history.refresh();
    if (!current()) return;
    if (!data || actions.tracking.error.value || actions.history.error.value)
      throw new Error('Could not reload payment details. Retry when connected.');
    hydrate(data);
    mode.value = null;
    requestId.value = crypto.randomUUID();
  } catch (err) {
    if (current()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
function message(err: unknown) {
  return err && typeof err === 'object' && 'message' in err
    ? String(err.message)
    : 'Could not save. Your choices are preserved.';
}
async function refreshOnly() {
  if (!savedRefresh.value) return;
  busy.value = true;
  error.value = null;
  try {
    await savedRefresh.value();
    if (current()) sheet.close();
  } catch (err) {
    if (current()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
async function save() {
  if (!payment.value || staleDate.value || busy.value || saved.value || linked.value) return;
  if (mode.value === 'undo' ? !undoAvailable.value : !candidate.value || !command.value) return;
  busy.value = true;
  error.value = null;
  try {
    const result =
      mode.value === 'undo'
        ? await actions.undo(payment.value, latest.value!.id, requestId.value)
        : await actions.apply(payment.value, command.value!, requestId.value);
    if (!current()) return;
    savedRefresh.value = result.refresh;
    await result.refresh();
    if (current()) sheet.close();
  } catch (err) {
    if (current()) error.value = message(err);
  } finally {
    busy.value = false;
  }
}
function linkExpense() {
  sheet.close();
  usePaymentLinkSheet().open({ paymentId: selectedId });
}
function reviewBalances() {
  sheet.close();
  usePaymentLinkSheet().open({ balanceReview: true });
}
function actionName(record: { command: unknown }) {
  const command = record.command as { action?: { kind?: string }; kind?: string };
  return (
    (
      {
        complete: 'Completed',
        correct: 'Actual corrected',
        cancel: 'Cancelled',
        postpone: 'Postponed',
        reopen: 'Reopened',
        undo: 'Undone',
      } as Record<string, string>
    )[command.action?.kind ?? command.kind ?? ''] ?? 'Payment reviewed'
  );
}
</script>
<template>
  <BaseSheet
    :open="!!sheet.paymentId.value"
    labelled-by="payment-action-title"
    :dismissible="!busy"
    @close="sheet.close"
  >
    <h2 id="payment-action-title" tabindex="-1" data-autofocus>
      {{ payment?.expected.label ?? 'This payment' }}
    </h2>
    <p v-if="staleDate && !saved" role="alert">
      The date changed. Reload and review before saving this payment.
    </p>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="saved"
      ><p role="status">Saved. Refresh your forecast without saving again.</p>
      <BaseButton :disabled="busy" @click="refreshOnly">Retry refresh</BaseButton></template
    >
    <p v-else-if="!snapshot && actions.tracking.loading.value" role="status">Loading payment…</p>
    <template v-else-if="payment && snapshot">
      <p>{{ stateLabel }} · This payment only. Later recurring payments stay scheduled.</p>
      <dl>
        <dt>Expected</dt>
        <dd>
          {{ formatMoney(payment.expected.amountMinor, payment.expected.currency as Currency) }} ·
          {{ formatFullDate(payment.expected.originalDate) }}
        </dd>
        <template v-if="payment.actual"
          ><dt>Actual</dt>
          <dd>
            {{ formatMoney(payment.actual.amountMinor, payment.actual.currency as Currency) }} ·
            {{ formatFullDate(payment.actual.date) }}
          </dd></template
        ><template v-if="payment.postponedDate"
          ><dt>New date</dt>
          <dd>{{ formatFullDate(payment.postponedDate) }}</dd></template
        >
      </dl>
      <p v-if="linked" role="status">
        Recorded in Pocket. Review the linked expense there before changing this payment.
      </p>
      <p v-if="retired">
        This payment was retired by a schedule change. Review the recurring source instead.
      </p>
      <p v-if="payment.needsReview">
        This payment needs balance review before its cash effect is reliable.
      </p>
      <template v-if="!mode">
        <div class="actions" v-if="!linked && !retired">
          <template v-if="unresolved"
            ><BaseButton :disabled="busy" @click="choose('complete')">{{
              outgoing ? 'Mark paid' : 'Mark received'
            }}</BaseButton
            ><BaseButton variant="secondary" @click="choose('postpone')">Change date</BaseButton
            ><BaseButton variant="secondary" @click="choose('cancel')"
              >Cancel this payment</BaseButton
            ></template
          ><template v-else
            ><BaseButton
              v-if="payment.state === 'completed'"
              variant="secondary"
              @click="choose('correct')"
              >Correct actual</BaseButton
            ><BaseButton variant="secondary" @click="choose('reopen')"
              >Reopen this payment</BaseButton
            ></template
          ><BaseButton v-if="undoAvailable" variant="secondary" @click="choose('undo')"
            >Undo last action</BaseButton
          >
        </div>
        <BaseButton v-if="outgoing" variant="secondary" @click="linkExpense">{{
          linked ? 'Review Pocket link' : 'Use an existing Pocket expense'
        }}</BaseButton>
      </template>
      <form v-else @submit.prevent="save">
        <template v-if="mode === 'complete' || mode === 'correct'">
          <label for="actual-account"
            >{{ outgoing ? 'Paid from' : 'Received into'
            }}<BaseSelect id="actual-account" v-model="accountId" :disabled="busy" required
              ><option value="">Choose account</option>
              <option v-for="a in accounts" :key="a.id" :value="a.id">
                {{ a.name }} ({{ a.currency }})
              </option></BaseSelect
            ></label
          >
          <label for="actual-amount"
            >Actual amount ({{ account?.currency ?? payment.expected.currency }})<BaseInput
              id="actual-amount"
              v-model="amount"
              inputmode="decimal"
              required
              :disabled="busy"
          /></label>
          <p v-if="account?.currency !== payment.expected.currency">
            Enter the native amount in this account’s currency; it will not be converted
            automatically.
          </p>
          <label for="actual-date"
            >Actual date<BaseInput
              id="actual-date"
              v-model="date"
              type="date"
              :max="snapshot.today"
              required
              :disabled="busy"
          /></label>
          <fieldset>
            <legend>Does your checked balance already include this payment?</legend>
            <p v-if="observation">
              Checked {{ formatFullDate(observation.date) }}:
              {{ formatMoney(observation.balanceMinor, observation.currency as Currency) }}
            </p>
            <p v-else>Check this account balance first, or save with cashflow marked for review.</p>
            <label class="choice"
              ><input
                v-model="inclusion"
                type="radio"
                value="included"
                :disabled="busy || !observation || date > observation.date"
              />Included — no new cash change</label
            ><label class="choice"
              ><input
                v-model="inclusion"
                type="radio"
                value="excluded"
                :disabled="busy || !observation"
              />Not included — apply the actual amount</label
            ><label class="choice"
              ><input v-model="inclusion" type="radio" value="unknown" :disabled="busy" />Not sure —
              needs balance review</label
            >
          </fieldset>
          <p v-if="outgoing">
            This records Horizon cashflow. It does not create a Pocket expense or use your everyday
            cap. Use an existing Pocket expense if you already recorded it.
          </p>
        </template>
        <label v-else-if="mode === 'postpone'" for="postponed-date"
          >New date<BaseInput
            id="postponed-date"
            v-model="date"
            type="date"
            :min="snapshot.today"
            required
            :disabled="busy"
        /></label>
        <p v-else-if="mode === 'cancel'">
          Cancel {{ payment.expected.label }} for
          {{ formatFullDate(payment.expected.originalDate) }}? Later payments remain scheduled.
        </p>
        <p v-else-if="mode === 'reopen'">
          Restore this payment to its original schedule? A newer checked balance is preserved and
          may need review.
        </p>
        <p v-else>Undo only the latest payment action. Checked balances will not be reversed.</p>
        <p v-if="preview?.qualified || inclusion === 'unknown'" role="status">
          Cashflow needs balance review; this estimate is not an exact affordability answer.
        </p>
        <p v-else-if="preview?.cash != null">
          Estimated cash after saving:
          {{ formatMoney(preview.cash, snapshot.projectionInput!.reportingCurrency as Currency) }}
        </p>
        <BaseButton
          type="submit"
          :disabled="
            busy || staleDate || !!linked || (mode === 'undo' ? !undoAvailable : !candidate)
          "
          >{{
            mode === 'cancel'
              ? 'Cancel this payment'
              : mode === 'undo'
                ? 'Undo last action'
                : mode === 'reopen'
                  ? 'Reopen this payment'
                  : 'Save payment'
          }}</BaseButton
        ><BaseButton variant="secondary" :disabled="busy" @click="mode = null">Back</BaseButton>
      </form>
      <details>
        <summary>Payment history</summary>
        <p v-if="actions.history.loading.value">Loading history…</p>
        <p v-if="actions.history.error.value" role="alert">{{ actions.history.error.value }}</p>
        <ol v-if="actions.records.value?.length">
          <li v-for="record in actions.records.value" :key="record.id">
            {{ actionName(record) }} · {{ new Date(record.recorded_at).toLocaleString() }}
          </li>
        </ol>
        <p v-else>No recorded actions yet.</p>
      </details>
      <BaseButton variant="secondary" :disabled="busy" @click="reviewBalances"
        >Review balances</BaseButton
      >
    </template>
    <p v-else role="status">
      {{
        actions.tracking.error.value ?? 'This payment is unavailable. Reload the latest details.'
      }}
    </p>
    <BaseButton v-if="!saved" variant="secondary" :disabled="busy" @click="reload"
      >Reload and review latest details</BaseButton
    >
    <BaseButton variant="secondary" :disabled="busy" @click="sheet.close">Close</BaseButton>
  </BaseSheet>
</template>
<style scoped>
h2 {
  margin: 0 0 var(--kapa-space-3);
  overflow-wrap: anywhere;
}
p {
  line-height: 1.5;
}
dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--kapa-space-2);
}
dd {
  margin: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
form,
.actions {
  display: grid;
  gap: var(--kapa-space-3);
}
label {
  display: grid;
  gap: var(--kapa-space-2);
}
fieldset {
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  padding: var(--kapa-space-3);
  min-width: 0;
}
.choice {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
  min-height: 44px;
}
.choice input {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
}
button {
  margin-block: var(--kapa-space-2);
}
summary {
  min-height: 44px;
  cursor: pointer;
  padding-block: var(--kapa-space-3);
}
</style>
