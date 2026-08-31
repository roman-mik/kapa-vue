<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import type { ScheduleCalendar } from '@roman-mik/kapa-core/horizon';
import { computed, ref, watch } from 'vue';
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import {
  type IncomeStreamEdit,
  type IncomeStreamMonth,
  type NewIncomeStream,
} from '@/composables/useIncomeStreams';
import {
  buildSchedulePreview,
  schedulesToPaymentRule,
  type SchedulePreviewItem,
} from '@/lib/horizon/incomeEditor';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import SchedulePreview from '@/components/horizon/SchedulePreview.vue';
import { accountNameSchema, firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';
import { z } from 'zod';

const CONFIDENCE_LABELS = {
  confirmed: 'Confirmed',
  expected: 'Expected',
  uncertain: 'Uncertain',
} as const;

const RECURRENCE_LABELS = {
  recurring: 'Recurring',
  oneOff: 'One-off',
} as const;

const props = defineProps<{
  accounts: Account[];
  spaceCurrency: Currency;
  /** 'YYYY-MM-DD' — the form's default start date (first of the current month). */
  defaultStartDate: string;
  calendar: ScheduleCalendar;
  /** When present the form edits this stream instead of creating one. */
  initial?: IncomeStreamMonth | null;
  save: (input: NewIncomeStream) => Promise<void>;
  update?: (input: IncomeStreamEdit) => Promise<void>;
  archive?: (id: string, updatedAt: string) => Promise<void>;
}>();

const emit = defineEmits<{ saved: []; cancelled: [] }>();

const KIND_LABELS = {
  hourly: 'Hourly',
  fixed: 'Fixed',
  variable: 'Variable',
} as const;

const isEdit = computed(() => !!props.initial);

const kind = ref<NewIncomeStream['kind']>('fixed');
const name = ref('');
const accountId = ref('');
const currency = ref<Currency>(props.spaceCurrency);
const taxable = ref(false);
const startDate = ref('');
const confidence = ref<NewIncomeStream['confidence']>('confirmed');
const recurrence = ref<NewIncomeStream['recurrence']>('recurring');
// Fixed / variable fields.
const amount = ref('');
const paymentRule = ref<NewIncomeStream['paymentRule']>('dayOfMonth');
const payDay = ref('15');
// Hourly fields.
const hourlyRate = ref('');
const hoursPerDay = ref('8');
const earningPeriod = ref<NewIncomeStream['earningPeriodKind']>('monthly');
const lagDays = ref('0');

const saving = ref(false);
const saveError = ref<string | null>(null);

const payDaySchema = z.coerce
  .number({ error: 'Enter a day between 1 and 31.' })
  .int('Enter a whole day between 1 and 31.')
  .min(1, 'Enter a day between 1 and 31.')
  .max(31, 'Enter a day between 1 and 31.');

const lagDaysSchema = z.coerce
  .number({ error: 'Enter a number of days.' })
  .int('Enter a whole number of days.')
  .min(0, 'Days can\u2019t be negative.');

function resetForm(): void {
  name.value = '';
  accountId.value = props.accounts[0]?.id ?? '';
  currency.value = props.spaceCurrency;
  taxable.value = false;
  startDate.value = props.defaultStartDate;
  confidence.value = 'confirmed';
  recurrence.value = 'recurring';
  kind.value = 'fixed';
  amount.value = '';
  paymentRule.value = 'dayOfMonth';
  payDay.value = '15';
  hourlyRate.value = '';
  hoursPerDay.value = '8';
  earningPeriod.value = 'monthly';
  lagDays.value = '0';
  saveError.value = null;
}

// Edit mode loads the stream's values into the form (immediate: the form only
// mounts once the editingId row exists, so the stream is already fetched).
watch(
  () => props.initial,
  (initial) => {
    if (!initial) {
      startDate.value = props.defaultStartDate;
      return;
    }
    name.value = initial.name;
    kind.value = initial.kind;
    accountId.value = initial.account_id;
    currency.value = initial.currency as Currency;
    taxable.value = initial.taxable;
    startDate.value = initial.start_date;
    confidence.value = (initial.confidence as NewIncomeStream['confidence']) ?? 'confirmed';
    recurrence.value = (initial.recurrence as NewIncomeStream['recurrence']) ?? 'recurring';
    earningPeriod.value =
      (initial.earning_period_kind as NewIncomeStream['earningPeriodKind']) ?? 'monthly';
    const exponent = CURRENCY_EXPONENT[initial.currency as Currency] ?? 2;
    if (initial.kind === 'hourly') {
      hourlyRate.value =
        initial.hourly_rate_minor != null ? String(initial.hourly_rate_minor / 10 ** exponent) : '';
      hoursPerDay.value =
        initial.hours_per_day_e2 != null ? String(initial.hours_per_day_e2 / 100) : '8';
      lagDays.value = String(initial.schedules[0]?.lag_days ?? 0);
    } else {
      amount.value =
        initial.fixed_amount_minor != null
          ? String(initial.fixed_amount_minor / 10 ** exponent)
          : '';
    }
    const rule = schedulesToPaymentRule(initial.schedules);
    paymentRule.value = rule.paymentRule;
    payDay.value = String(rule.payDay);
    saveError.value = null;
  },
  { immediate: true }
);

watch(
  () => props.spaceCurrency,
  (c) => (currency.value = c)
);
watch(
  () => props.accounts,
  (accounts) => {
    if (!accountId.value && accounts.length) accountId.value = accounts[0].id;
  }
);

const isHourly = computed(() => kind.value === 'hourly');

// The preview pins its window to today — only genuinely upcoming payments.
const space = useSpaceStore();
const fromKey = computed<string | null>(() => {
  const start = props.initial?.start_date ?? props.defaultStartDate;
  if (!start) return null;
  const today = space.currentSpace ? zonedDateKey(new Date(), space.currentSpace.timezone) : '';
  return today && today > start ? today : start;
});

const previewItems = computed<SchedulePreviewItem[]>(() => {
  if (!fromKey.value) return [];
  return buildSchedulePreview(
    {
      kind: kind.value,
      paymentRule: isHourly.value ? 'dayOfMonth' : paymentRule.value,
      payDay: isHourly.value ? 15 : Number(payDay.value),
      earningPeriodKind: isHourly.value ? earningPeriod.value : 'monthly',
      lagDays: isHourly.value ? Number(lagDays.value) || 0 : 0,
    },
    props.calendar,
    fromKey.value
  );
});

async function onSubmit(): Promise<void> {
  saveError.value = null;
  const parsedName = accountNameSchema.safeParse(name.value);
  if (!parsedName.success) {
    saveError.value = firstIssueMessage(parsedName) ?? 'Enter a name.';
    return;
  }
  const exponent = CURRENCY_EXPONENT[currency.value];

  let hourlyRateMinor: number | null = null;
  let hoursPerDayE2: number | null = null;
  let amountMinor: number | null = null;
  if (kind.value === 'hourly') {
    const parsedRate = positiveAmountSchema.safeParse(hourlyRate.value);
    if (!parsedRate.success) {
      saveError.value = firstIssueMessage(parsedRate) ?? 'Enter a valid rate.';
      return;
    }
    const parsedHours = positiveAmountSchema.safeParse(hoursPerDay.value);
    if (!parsedHours.success) {
      saveError.value = firstIssueMessage(parsedHours) ?? 'Enter valid hours per day.';
      return;
    }
    const parsedLag = lagDaysSchema.safeParse(lagDays.value);
    if (!parsedLag.success) {
      saveError.value = firstIssueMessage(parsedLag) ?? 'Enter a number of days.';
      return;
    }
    hourlyRateMinor = Math.round(parsedRate.data * 10 ** exponent);
    hoursPerDayE2 = Math.round(parsedHours.data * 100);
    lagDays.value = String(parsedLag.data);
  } else {
    const parsedAmount = positiveAmountSchema.safeParse(amount.value);
    if (!parsedAmount.success) {
      saveError.value = firstIssueMessage(parsedAmount) ?? 'Enter a valid amount.';
      return;
    }
    if (paymentRule.value === 'dayOfMonth') {
      const parsedPayDay = payDaySchema.safeParse(payDay.value);
      if (!parsedPayDay.success) {
        saveError.value = firstIssueMessage(parsedPayDay) ?? 'Enter a day between 1 and 31.';
        return;
      }
      payDay.value = String(parsedPayDay.data);
    }
    amountMinor = Math.round(parsedAmount.data * 10 ** exponent);
  }

  const input: NewIncomeStream = {
    name: parsedName.data,
    kind: kind.value,
    currency: currency.value,
    accountId: accountId.value,
    startDate: startDate.value || props.defaultStartDate,
    earningPeriodKind: kind.value === 'hourly' ? earningPeriod.value : 'monthly',
    hourlyRateMinor,
    hoursPerDayE2,
    lagDays: kind.value === 'hourly' ? Number(lagDays.value) : 0,
    amountMinor,
    paymentRule: kind.value === 'hourly' ? 'dayOfMonth' : paymentRule.value,
    payDay: kind.value === 'hourly' ? 15 : Number(payDay.value),
    taxable: taxable.value,
    confidence: confidence.value,
    recurrence: recurrence.value,
  };

  saving.value = true;
  try {
    if (props.initial && props.update) {
      await props.update({
        ...input,
        id: props.initial.id,
        updatedAt: props.initial.updated_at,
      });
    } else {
      await props.save(input);
    }
    resetForm();
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save the income stream.";
  } finally {
    saving.value = false;
  }
}

async function onArchive(): Promise<void> {
  if (!props.initial || !props.archive) return;
  saveError.value = null;
  saving.value = true;
  try {
    await props.archive(props.initial.id, props.initial.updated_at);
    resetForm();
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't archive the income stream.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard class="form-card">
    <h2>{{ isEdit ? 'Edit income' : 'Add income' }}</h2>
    <form class="form" @submit.prevent="onSubmit">
      <div class="grid">
        <BaseField label="Name" v-slot="{ id }">
          <BaseInput :id="id" v-model="name" required />
        </BaseField>

        <BaseField label="Type" v-slot="{ id }">
          <BaseSelect :id="id" v-model="kind">
            <option v-for="(label, value) in KIND_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </BaseSelect>
        </BaseField>
      </div>

      <div class="grid">
        <BaseField label="Receiving account" v-slot="{ id }">
          <BaseSelect :id="id" v-model="accountId" required>
            <option v-for="account in accounts" :key="account.id" :value="account.id">
              {{ account.name }}
            </option>
          </BaseSelect>
        </BaseField>

        <BaseField label="Currency" v-slot="{ id }">
          <BaseSelect :id="id" v-model="currency">
            <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
          </BaseSelect>
        </BaseField>
      </div>

      <div class="grid">
        <BaseField label="Start date" v-slot="{ id }">
          <BaseInput :id="id" v-model="startDate" type="date" />
        </BaseField>

        <BaseField label="Confidence" v-slot="{ id }">
          <BaseSelect :id="id" v-model="confidence">
            <option v-for="(label, value) in CONFIDENCE_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </BaseSelect>
        </BaseField>
      </div>

      <template v-if="isHourly">
        <div class="grid">
          <BaseField label="Hourly rate" v-slot="{ id }">
            <BaseInput
              :id="id"
              v-model="hourlyRate"
              type="number"
              :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
            />
          </BaseField>

          <BaseField label="Hours per day" v-slot="{ id }">
            <BaseInput :id="id" v-model="hoursPerDay" type="number" step="0.5" />
          </BaseField>
        </div>

        <div class="grid">
          <BaseField label="Earning period" v-slot="{ id }">
            <BaseSelect :id="id" v-model="earningPeriod">
              <option value="monthly">Monthly (1st–end of month)</option>
              <option value="semiMonthly">Semi-monthly (1st–15th, 16th–end)</option>
            </BaseSelect>
          </BaseField>

          <BaseField label="Pay days after the period ends" v-slot="{ id }">
            <BaseInput :id="id" v-model="lagDays" type="number" min="0" step="1" />
          </BaseField>
        </div>
      </template>

      <template v-else>
        <div class="grid">
          <BaseField label="Amount per payment" v-slot="{ id }">
            <BaseInput
              :id="id"
              v-model="amount"
              type="number"
              :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
            />
          </BaseField>

          <BaseField label="When" v-slot="{ id }">
            <BaseSelect :id="id" v-model="paymentRule">
              <option value="dayOfMonth">Day of month</option>
              <option value="monthEnd">End of month</option>
              <option value="semiMonthly">Twice a month (1st &amp; 15th)</option>
            </BaseSelect>
          </BaseField>
        </div>

        <BaseField v-if="paymentRule === 'dayOfMonth'" label="Pay day" v-slot="{ id }">
          <BaseInput :id="id" v-model="payDay" type="number" min="1" max="31" step="1" />
        </BaseField>
      </template>

      <div class="grid">
        <BaseField label="Repeats" v-slot="{ id }">
          <BaseSelect :id="id" v-model="recurrence">
            <option v-for="(label, value) in RECURRENCE_LABELS" :key="value" :value="value">
              {{ label }}
            </option>
          </BaseSelect>
        </BaseField>

        <BaseCheckbox v-model="taxable" label="Taxable income" />
      </div>

      <div v-if="previewItems.length" class="preview-wrap">
        <span class="preview-label">Payment preview</span>
        <SchedulePreview :items="previewItems" />
      </div>

      <div class="actions">
        <template v-if="isEdit">
          <BaseButton type="button" variant="danger" :disabled="saving" @click="onArchive">
            {{ saving ? 'Working…' : 'Archive' }}
          </BaseButton>
          <BaseButton
            type="button"
            variant="secondary"
            :disabled="saving"
            @click="emit('cancelled')"
          >
            Cancel
          </BaseButton>
          <BaseButton type="submit" :disabled="saving">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </BaseButton>
        </template>
        <BaseButton v-else type="submit" :disabled="saving">
          {{ saving ? 'Adding…' : 'Add income' }}
        </BaseButton>
      </div>
      <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>
    </form>
  </BaseCard>
</template>

<style scoped>
.form-card {
  margin: var(--kapa-space-5) 0;
}

.form-card h2 {
  margin-bottom: var(--kapa-space-4);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--kapa-space-3);
}

.preview-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.preview-label {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--kapa-space-2);
  margin-top: var(--kapa-space-2);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
