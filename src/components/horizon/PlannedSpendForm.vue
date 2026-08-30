<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { CHARGE_CADENCES, type ChargeCadence } from '@roman-mik/kapa-core/horizon';
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import type { Category } from '@roman-mik/kapa-core/core';
import { ref, watch, computed } from 'vue';
import type { NewPlannedSpend } from '@/composables/usePlannedSpend';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import {
  accountNameSchema,
  expenseDateSchema,
  firstIssueMessage,
  optionalPositiveAmountSchema,
  positiveAmountSchema,
} from '@/lib/validation';

const props = defineProps<{
  accounts: Account[];
  categories: Category[];
  spaceCurrency: Currency;
  /** 'YYYY-MM-DD' — the form's default start date. */
  defaultStartDate: string;
  save: (input: NewPlannedSpend) => Promise<void>;
}>();

const emit = defineEmits<{ saved: [] }>();

const CADENCE_LABELS: Record<ChargeCadence, string> = {
  daily: 'Amount per day',
  weekly: 'Amount per week',
  monthly: 'Amount per month',
};

const name = ref('');
const accountId = ref('');
const categoryId = ref('');
const currency = ref<Currency>(props.spaceCurrency);
const dailyAmount = ref('');
const chargeCadence = ref<ChargeCadence>('daily');
const cap = ref('');
const startDate = ref(props.defaultStartDate);
const endDate = ref('');

const saving = ref(false);
const saveError = ref<string | null>(null);

const amountLabel = computed(() => CADENCE_LABELS[chargeCadence.value]);

function resetForm(): void {
  name.value = '';
  accountId.value = props.accounts[0]?.id ?? '';
  categoryId.value = '';
  currency.value = props.spaceCurrency;
  dailyAmount.value = '';
  chargeCadence.value = 'daily';
  cap.value = '';
  startDate.value = props.defaultStartDate;
  endDate.value = '';
  saveError.value = null;
}

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
watch(
  () => props.defaultStartDate,
  (d) => {
    if (!startDate.value) startDate.value = d;
  }
);

async function onSubmit(): Promise<void> {
  saveError.value = null;
  const parsedName = accountNameSchema.safeParse(name.value);
  if (!parsedName.success) {
    saveError.value = firstIssueMessage(parsedName) ?? 'Enter a name.';
    return;
  }
  const parsedAmount = positiveAmountSchema.safeParse(dailyAmount.value);
  if (!parsedAmount.success) {
    saveError.value = firstIssueMessage(parsedAmount) ?? 'Enter a valid amount.';
    return;
  }
  const parsedCap = optionalPositiveAmountSchema.safeParse(cap.value);
  if (!parsedCap.success) {
    saveError.value = firstIssueMessage(parsedCap) ?? 'Enter a valid amount.';
    return;
  }
  const parsedStart = expenseDateSchema.safeParse(startDate.value);
  if (!parsedStart.success) {
    saveError.value = firstIssueMessage(parsedStart) ?? 'Pick a valid date.';
    return;
  }
  if (endDate.value) {
    const parsedEnd = expenseDateSchema.safeParse(endDate.value);
    if (!parsedEnd.success) {
      saveError.value = firstIssueMessage(parsedEnd) ?? 'Pick a valid date.';
      return;
    }
  }
  const exponent = CURRENCY_EXPONENT[currency.value];
  const capExponent = CURRENCY_EXPONENT[currency.value];

  saving.value = true;
  try {
    await props.save({
      name: parsedName.data,
      categoryId: categoryId.value || null,
      currency: currency.value,
      accountId: accountId.value,
      dailyAmountMinor: Math.round(parsedAmount.data * 10 ** exponent),
      chargeCadence: chargeCadence.value,
      capMinor: parsedCap.data == null ? null : Math.round(parsedCap.data * 10 ** capExponent),
      startDate: startDate.value,
      endDate: endDate.value || null,
    });
    resetForm();
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't add the planned spend.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard class="form-card">
    <h2>Add planned spend</h2>
    <form class="form" @submit.prevent="onSubmit">
      <div class="grid">
        <BaseField label="Name" v-slot="{ id }">
          <BaseInput :id="id" v-model="name" required />
        </BaseField>

        <BaseField label="Category" v-slot="{ id }">
          <BaseSelect :id="id" v-model="categoryId">
            <option value="">Uncategorized</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
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
        <BaseField :label="amountLabel" v-slot="{ id }">
          <BaseInput
            :id="id"
            v-model="dailyAmount"
            type="number"
            :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
          />
        </BaseField>

        <BaseField label="Cadence" v-slot="{ id }">
          <BaseSelect :id="id" v-model="chargeCadence">
            <option v-for="c in CHARGE_CADENCES" :key="c" :value="c">
              {{ CADENCE_LABELS[c] }}
            </option>
          </BaseSelect>
        </BaseField>
      </div>

      <div class="grid">
        <BaseField label="Cap (optional)" v-slot="{ id }">
          <BaseInput
            :id="id"
            v-model="cap"
            type="number"
            :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
          />
        </BaseField>
      </div>

      <div class="grid">
        <BaseField label="Start date" v-slot="{ id }">
          <BaseInput :id="id" v-model="startDate" type="date" required />
        </BaseField>

        <BaseField label="End date (optional)" v-slot="{ id }">
          <BaseInput :id="id" v-model="endDate" type="date" />
        </BaseField>
      </div>

      <div class="actions">
        <BaseButton type="submit" :disabled="saving">
          {{ saving ? 'Adding…' : 'Add planned spend' }}
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
