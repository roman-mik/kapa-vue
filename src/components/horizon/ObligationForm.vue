<script setup lang="ts">
import {
  CURRENCIES,
  CURRENCY_EXPONENT,
  zonedDateKey,
  type Currency,
} from '@roman-mik/kapa-core/pocket';
import { type ScheduleCalendar } from '@roman-mik/kapa-core/horizon';
import { OBLIGATION_CATEGORIES } from '@roman-mik/kapa-core/horizon';
import { computed, ref, watch } from 'vue';
import type { Account, ObligationWithSchedules } from '@roman-mik/kapa-core/horizon/queries';
import {
  OBLIGATION_CATEGORY_LABELS,
  type NewObligation,
  type ObligationCategory,
  type ObligationEdit,
} from '@/composables/useObligations';
import { obligationPreviewDates, schedulesToObligationRule } from '@/lib/horizon/obligationEditor';
import type { SchedulePreviewItem } from '@/lib/horizon/incomeEditor';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import SchedulePreview from '@/components/horizon/SchedulePreview.vue';
import { accountNameSchema, firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';
import { z } from 'zod';

const props = defineProps<{
  accounts: Account[];
  spaceCurrency: Currency;
  /** 'YYYY-MM-DD' — the form's default start date. */
  defaultStartDate: string;
  calendar: ScheduleCalendar;
  /** When present the form edits this obligation instead of creating one. */
  initial?: ObligationWithSchedules | null;
  save: (input: NewObligation) => Promise<void>;
  update?: (input: ObligationEdit) => Promise<void>;
  archive?: (id: string, updatedAt: string) => Promise<void>;
}>();

const emit = defineEmits<{ saved: []; cancelled: []; archived: [] }>();

const isEdit = computed(() => !!props.initial);

const name = ref('');
const accountId = ref('');
const category = ref<ObligationCategory>('housing');
const currency = ref<Currency>(props.spaceCurrency);
const amount = ref('');
const when = ref<'dayOfMonth' | 'monthEnd'>('dayOfMonth');
const dueDay = ref('1');
const startDate = ref(props.defaultStartDate);

const saving = ref(false);
const saveError = ref<string | null>(null);

const dueDaySchema = z.coerce
  .number({ error: 'Enter a day between 1 and 31.' })
  .int('Enter a whole day between 1 and 31.')
  .min(1, 'Enter a day between 1 and 31.')
  .max(31, 'Enter a day between 1 and 31.');

function resetForm(): void {
  name.value = '';
  accountId.value = props.accounts[0]?.id ?? '';
  category.value = 'housing';
  currency.value = props.spaceCurrency;
  amount.value = '';
  when.value = 'dayOfMonth';
  dueDay.value = '1';
  startDate.value = props.defaultStartDate;
  saveError.value = null;
}

// Edit mode loads the obligation's values into the form (immediate: the form
// only mounts once the editingId row exists, so the obligation is already
// fetched). The schedule round-trips onto the When/Due-day fields.
watch(
  () => props.initial,
  (initial) => {
    if (!initial) {
      startDate.value = props.defaultStartDate;
      return;
    }
    name.value = initial.name;
    accountId.value = initial.account_id;
    category.value = (initial.category as ObligationCategory) ?? 'housing';
    currency.value = (initial.currency as Currency) ?? props.spaceCurrency;
    const exponent = CURRENCY_EXPONENT[currency.value] ?? 2;
    amount.value = String(initial.amount_minor / 10 ** exponent);
    startDate.value = initial.start_date;
    const rule = schedulesToObligationRule(initial.schedules);
    when.value = rule.when;
    dueDay.value = String(rule.dueDay);
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
  return obligationPreviewDates(
    { when: when.value, dueDay: Number(dueDay.value) || 1 },
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
  const parsedAmount = positiveAmountSchema.safeParse(amount.value);
  if (!parsedAmount.success) {
    saveError.value = firstIssueMessage(parsedAmount) ?? 'Enter a valid amount.';
    return;
  }
  let due = 1;
  if (when.value === 'dayOfMonth') {
    const parsedDue = dueDaySchema.safeParse(dueDay.value);
    if (!parsedDue.success) {
      saveError.value = firstIssueMessage(parsedDue) ?? 'Enter a day between 1 and 31.';
      return;
    }
    due = parsedDue.data;
    dueDay.value = String(due);
  }
  const exponent = CURRENCY_EXPONENT[currency.value];

  const input: NewObligation = {
    name: parsedName.data,
    category: category.value,
    currency: currency.value,
    accountId: accountId.value,
    startDate: startDate.value || props.defaultStartDate,
    amountMinor: Math.round(parsedAmount.data * 10 ** exponent),
    rule:
      when.value === 'monthEnd' ? { kind: 'monthEnd' } : { kind: 'dayOfMonth', dayOfMonth: due },
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
    saveError.value = err instanceof Error ? err.message : "Couldn't save the obligation.";
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
    emit('archived');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't archive the obligation.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard class="form-card">
    <h2>{{ isEdit ? 'Edit obligation' : 'Add obligation' }}</h2>
    <form class="form" @submit.prevent="onSubmit">
      <div class="grid">
        <BaseField label="Name" v-slot="{ id }">
          <BaseInput :id="id" v-model="name" required />
        </BaseField>

        <BaseField label="Category" v-slot="{ id }">
          <BaseSelect :id="id" v-model="category">
            <option v-for="c in OBLIGATION_CATEGORIES" :key="c" :value="c">
              {{ OBLIGATION_CATEGORY_LABELS[c] }}
            </option>
          </BaseSelect>
        </BaseField>
      </div>

      <div class="grid">
        <BaseField label="Paying from" v-slot="{ id }">
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
        <BaseField label="Amount per payment" v-slot="{ id }">
          <BaseInput
            :id="id"
            v-model="amount"
            type="number"
            :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
          />
        </BaseField>

        <BaseField label="When" v-slot="{ id }">
          <BaseSelect :id="id" v-model="when">
            <option value="dayOfMonth">Day of month</option>
            <option value="monthEnd">End of month</option>
          </BaseSelect>
        </BaseField>
      </div>

      <BaseField v-if="when === 'dayOfMonth'" label="Due day" v-slot="{ id }">
        <BaseInput :id="id" v-model="dueDay" type="number" min="1" max="31" step="1" />
      </BaseField>

      <div class="grid">
        <BaseField label="Start date" v-slot="{ id }">
          <BaseInput :id="id" v-model="startDate" type="date" />
        </BaseField>
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
          {{ saving ? 'Adding…' : 'Add obligation' }}
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
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
