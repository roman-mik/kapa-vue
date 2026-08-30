<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { OBLIGATION_CATEGORIES } from '@roman-mik/kapa-core/horizon/categories';
import { ref, watch } from 'vue';
import type { Account } from '@roman-mik/kapa-core/horizon';
import {
  OBLIGATION_CATEGORY_LABELS,
  type NewObligation,
  type ObligationCategory,
} from '@/composables/useObligations';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import { accountNameSchema, firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { z } from 'zod';

const props = defineProps<{
  accounts: Account[];
  spaceCurrency: Currency;
  /** 'YYYY-MM-DD' — the form's default start date. */
  defaultStartDate: string;
  save: (input: NewObligation) => Promise<void>;
}>();

const emit = defineEmits<{ saved: [] }>();

const name = ref('');
const accountId = ref('');
const category = ref<ObligationCategory>('housing');
const currency = ref<Currency>(props.spaceCurrency);
const amount = ref('');
const when = ref<'dayOfMonth' | 'monthEnd'>('dayOfMonth');
const dueDay = ref('1');

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

  saving.value = true;
  try {
    await props.save({
      name: parsedName.data,
      category: category.value,
      currency: currency.value,
      accountId: accountId.value,
      startDate: props.defaultStartDate,
      amountMinor: Math.round(parsedAmount.data * 10 ** exponent),
      rule:
        when.value === 'monthEnd' ? { kind: 'monthEnd' } : { kind: 'dayOfMonth', dayOfMonth: due },
    });
    resetForm();
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't add the obligation.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard class="form-card">
    <h2>Add obligation</h2>
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

      <div class="actions">
        <BaseButton type="submit" :disabled="saving">
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
