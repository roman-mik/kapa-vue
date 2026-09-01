<script setup lang="ts">
import {
  CURRENCIES,
  CURRENCY_EXPONENT,
  zonedDateKey,
  type Currency,
} from '@roman-mik/kapa-core/pocket';
import type { ScheduleCalendar } from '@roman-mik/kapa-core/horizon';
import type { ObligationWithSchedules, OneOffEvent } from '@roman-mik/kapa-core/horizon/queries';
import { computed, ref, watch } from 'vue';
import type { ObligationEdit } from '@/composables/useObligations';
import type { IncomeStreamEdit, IncomeStreamMonth } from '@/composables/useIncomeStreams';
import type { OneOffEventEdit } from '@/composables/useOneOffEvents';
import {
  buildSchedulePreview,
  schedulesToPaymentRule,
  type SchedulePreviewItem,
} from '@/lib/horizon/incomeEditor';
import { obligationPreviewDates, schedulesToObligationRule } from '@/lib/horizon/obligationEditor';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import SchedulePreview from '@/components/horizon/SchedulePreview.vue';
import { expenseDateSchema, firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';
import { z } from 'zod';

/**
 * The compact artboard-9 editor for the three kinds whose edit surface fits
 * amount + day + a six-date schedule preview: obligations, fixed/variable
 * income streams, and one-offs. Hourly streams and planned spend need fields
 * this shape can't express (H6 earning-period/lag, cadence/cap) — those stay
 * on their full forms (`IncomeStreamForm.vue` / `PlannedSpendForm.vue`).
 *
 * Everything the compact fields don't expose (name, account, category,
 * confidence, recurrence, taxable, direction…) round-trips from `entry.initial`
 * unchanged — this editor only ever touches amount, currency, and schedule.
 */
export type RowEditorEntry =
  | {
      kind: 'obligation';
      initial: ObligationWithSchedules;
      calendar: ScheduleCalendar;
      update: (input: ObligationEdit) => Promise<void>;
      archive: (id: string, updatedAt: string) => Promise<void>;
    }
  | {
      kind: 'stream';
      initial: IncomeStreamMonth;
      calendar: ScheduleCalendar;
      update: (input: IncomeStreamEdit) => Promise<void>;
      archive: (id: string, updatedAt: string) => Promise<void>;
    }
  | {
      kind: 'oneOff';
      initial: OneOffEvent;
      update: (input: OneOffEventEdit) => Promise<void>;
      remove: (id: string) => Promise<void>;
    };

const props = defineProps<{ entry: RowEditorEntry }>();

const emit = defineEmits<{ saved: []; cancelled: []; archived: []; removed: [] }>();

const space = useSpaceStore();

const saving = ref(false);
const saveError = ref<string | null>(null);

const amount = ref('');
const currency = ref<Currency>('RSD');
// Obligation / stream schedule fields.
const when = ref<'dayOfMonth' | 'monthEnd' | 'semiMonthly'>('dayOfMonth');
const day = ref('1');
// One-off's own date field.
const date = ref('');

function exponentFor(c: Currency): number {
  return CURRENCY_EXPONENT[c] ?? 2;
}

function loadFromEntry(entry: RowEditorEntry): void {
  saveError.value = null;
  if (entry.kind === 'obligation') {
    currency.value = entry.initial.currency as Currency;
    amount.value = String(entry.initial.amount_minor / 10 ** exponentFor(currency.value));
    const rule = schedulesToObligationRule(entry.initial.schedules);
    when.value = rule.when;
    day.value = String(rule.dueDay);
  } else if (entry.kind === 'stream') {
    currency.value = entry.initial.currency as Currency;
    amount.value = String(
      (entry.initial.fixed_amount_minor ?? 0) / 10 ** exponentFor(currency.value)
    );
    const rule = schedulesToPaymentRule(entry.initial.schedules);
    when.value = rule.paymentRule;
    day.value = String(rule.payDay);
  } else {
    currency.value = entry.initial.currency as Currency;
    amount.value = String(entry.initial.amount_minor / 10 ** exponentFor(currency.value));
    date.value = entry.initial.date;
  }
}

watch(() => props.entry, loadFromEntry, { immediate: true });

const fromKey = computed<string | null>(() => {
  const entry = props.entry;
  const start = entry.kind === 'oneOff' ? null : entry.initial.start_date;
  if (!start) return null;
  const today = space.currentSpace ? zonedDateKey(new Date(), space.currentSpace.timezone) : '';
  return today && today > start ? today : start;
});

const previewItems = computed<SchedulePreviewItem[]>(() => {
  const entry = props.entry;
  if (entry.kind === 'oneOff' || !fromKey.value) return [];
  if (entry.kind === 'obligation') {
    return obligationPreviewDates(
      {
        when: when.value === 'semiMonthly' ? 'dayOfMonth' : when.value,
        dueDay: Number(day.value) || 1,
      },
      entry.calendar,
      fromKey.value
    );
  }
  return buildSchedulePreview(
    {
      kind: entry.initial.kind as 'fixed' | 'variable',
      paymentRule: when.value,
      payDay: Number(day.value) || 1,
      earningPeriodKind: 'monthly',
      lagDays: 0,
    },
    entry.calendar,
    fromKey.value
  );
});

async function onSave(): Promise<void> {
  saveError.value = null;
  const entry = props.entry;
  const parsedAmount = positiveAmountSchema.safeParse(amount.value);
  if (!parsedAmount.success) {
    saveError.value = firstIssueMessage(parsedAmount) ?? 'Enter a valid amount.';
    return;
  }
  const amountMinor = Math.round(parsedAmount.data * 10 ** exponentFor(currency.value));

  saving.value = true;
  try {
    if (entry.kind === 'obligation') {
      if (when.value === 'dayOfMonth' || when.value === 'semiMonthly') {
        const parsedDay = z1to31.safeParse(day.value);
        if (!parsedDay.success) {
          saveError.value = 'Enter a day between 1 and 31.';
          saving.value = false;
          return;
        }
        day.value = String(parsedDay.data);
      }
      await entry.update({
        id: entry.initial.id,
        updatedAt: entry.initial.updated_at,
        name: entry.initial.name,
        category: entry.initial.category as ObligationEdit['category'],
        currency: currency.value,
        accountId: entry.initial.account_id,
        startDate: entry.initial.start_date,
        amountMinor,
        rule:
          when.value === 'monthEnd'
            ? { kind: 'monthEnd' }
            : { kind: 'dayOfMonth', dayOfMonth: Number(day.value) },
      });
    } else if (entry.kind === 'stream') {
      if (when.value !== 'monthEnd') {
        const parsedDay = z1to31.safeParse(day.value);
        if (!parsedDay.success) {
          saveError.value = 'Enter a day between 1 and 31.';
          saving.value = false;
          return;
        }
        day.value = String(parsedDay.data);
      }
      await entry.update({
        id: entry.initial.id,
        updatedAt: entry.initial.updated_at,
        name: entry.initial.name,
        kind: entry.initial.kind as IncomeStreamEdit['kind'],
        currency: currency.value,
        accountId: entry.initial.account_id,
        startDate: entry.initial.start_date,
        earningPeriodKind: entry.initial
          .earning_period_kind as IncomeStreamEdit['earningPeriodKind'],
        hourlyRateMinor: null,
        hoursPerDayE2: null,
        lagDays: 0,
        amountMinor,
        paymentRule: when.value,
        payDay: Number(day.value),
        taxable: entry.initial.taxable,
        confidence: entry.initial.confidence as IncomeStreamEdit['confidence'],
        recurrence: entry.initial.recurrence as IncomeStreamEdit['recurrence'],
      });
    } else {
      const parsedDate = expenseDateSchema.safeParse(date.value);
      if (!parsedDate.success) {
        saveError.value = firstIssueMessage(parsedDate) ?? 'Pick a valid date.';
        saving.value = false;
        return;
      }
      await entry.update({
        id: entry.initial.id,
        name: entry.initial.name,
        category: entry.initial.category as OneOffEventEdit['category'],
        currency: currency.value,
        accountId: entry.initial.account_id,
        date: parsedDate.data,
        amountMinor,
        direction: entry.initial.direction as OneOffEventEdit['direction'],
      });
    }
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save.";
  } finally {
    saving.value = false;
  }
}

async function onArchive(): Promise<void> {
  const entry = props.entry;
  if (entry.kind === 'oneOff') return;
  saveError.value = null;
  saving.value = true;
  try {
    await entry.archive(entry.initial.id, entry.initial.updated_at);
    emit('archived');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't archive.";
  } finally {
    saving.value = false;
  }
}

async function onRemove(): Promise<void> {
  const entry = props.entry;
  if (entry.kind !== 'oneOff') return;
  saveError.value = null;
  saving.value = true;
  try {
    await entry.remove(entry.initial.id);
    emit('removed');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't delete.";
  } finally {
    saving.value = false;
  }
}

const z1to31 = z.coerce
  .number({ error: 'Enter a day between 1 and 31.' })
  .int('Enter a whole day between 1 and 31.')
  .min(1, 'Enter a day between 1 and 31.')
  .max(31, 'Enter a day between 1 and 31.');
</script>

<template>
  <BaseCard class="row-editor" data-testid="row-editor">
    <div class="header">
      <span class="editing-badge">Editing</span>
    </div>

    <div class="grid">
      <BaseField label="Amount" v-slot="{ id }">
        <BaseInput
          :id="id"
          v-model="amount"
          type="number"
          class="amount-input"
          :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
        />
      </BaseField>

      <BaseField label="Currency" v-slot="{ id }">
        <BaseSelect :id="id" v-model="currency">
          <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </BaseSelect>
      </BaseField>
    </div>

    <template v-if="entry.kind === 'oneOff'">
      <BaseField label="Date" v-slot="{ id }">
        <BaseInput :id="id" v-model="date" type="date" required />
      </BaseField>
    </template>

    <template v-else>
      <div class="grid">
        <BaseField label="When" v-slot="{ id }">
          <BaseSelect :id="id" v-model="when">
            <option value="dayOfMonth">Day of month</option>
            <option value="monthEnd">End of month</option>
            <option v-if="entry.kind === 'stream'" value="semiMonthly">
              Twice a month (1st &amp; 15th)
            </option>
          </BaseSelect>
        </BaseField>

        <BaseField v-if="when === 'dayOfMonth'" label="Day" v-slot="{ id }">
          <BaseInput :id="id" v-model="day" type="number" min="1" max="31" step="1" />
        </BaseField>
      </div>

      <div v-if="previewItems.length" class="preview-wrap">
        <span class="preview-label">Payment preview</span>
        <SchedulePreview :items="previewItems" />
      </div>
    </template>

    <div class="actions">
      <BaseButton
        type="button"
        variant="danger"
        :disabled="saving"
        @click="entry.kind === 'oneOff' ? onRemove() : onArchive()"
      >
        {{ saving ? 'Working…' : entry.kind === 'oneOff' ? 'Delete' : 'Archive' }}
      </BaseButton>
      <BaseButton type="button" variant="secondary" :disabled="saving" @click="emit('cancelled')">
        Cancel
      </BaseButton>
      <BaseButton type="button" :disabled="saving" @click="onSave">
        {{ saving ? 'Saving…' : 'Save' }}
      </BaseButton>
    </div>
    <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>
  </BaseCard>
</template>

<style scoped>
.row-editor {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
  box-shadow: 0 4px 16px rgba(46, 43, 37, 0.12);
}

.header {
  display: flex;
}

.editing-badge {
  font-size: var(--kapa-text-caption-size);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--kapa-accent-800);
  background: var(--kapa-accent-100);
  border-radius: 999px;
  padding: 0 var(--kapa-space-2);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--kapa-space-3);
}

.amount-input {
  min-height: 48px;
  border-color: var(--kapa-accent);
  font-weight: 600;
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
