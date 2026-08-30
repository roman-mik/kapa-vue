<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import type { Account, OneOffDirection } from '@roman-mik/kapa-core/horizon/queries';
import { ref, watch } from 'vue';
import {
  ONE_OFF_CATEGORY_LABELS,
  SPEND_CATEGORIES,
  type NewOneOffEvent,
  type OneOffCategory,
} from '@/composables/useOneOffEvents';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import {
  accountNameSchema,
  expenseDateSchema,
  firstIssueMessage,
  positiveAmountSchema,
} from '@/lib/validation';

const props = defineProps<{
  accounts: Account[];
  spaceCurrency: Currency;
  /** 'YYYY-MM-DD' — the form's default date (today, in the space's timezone). */
  defaultDate: string;
  save: (input: NewOneOffEvent) => Promise<void>;
}>();

const emit = defineEmits<{ saved: [] }>();

const name = ref('');
const accountId = ref('');
const category = ref<OneOffCategory>('other');
const direction = ref<OneOffDirection>('out');
const currency = ref<Currency>(props.spaceCurrency);
const amount = ref('');
const date = ref(props.defaultDate);

const saving = ref(false);
const saveError = ref<string | null>(null);

function resetForm(): void {
  name.value = '';
  accountId.value = props.accounts[0]?.id ?? '';
  category.value = 'other';
  direction.value = 'out';
  currency.value = props.spaceCurrency;
  amount.value = '';
  date.value = props.defaultDate;
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
  () => props.defaultDate,
  (d) => {
    if (!date.value) date.value = d;
  },
  { immediate: true }
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
  const parsedDate = expenseDateSchema.safeParse(date.value);
  if (!parsedDate.success) {
    saveError.value = firstIssueMessage(parsedDate) ?? 'Pick a valid date.';
    return;
  }
  const exponent = CURRENCY_EXPONENT[currency.value];

  saving.value = true;
  try {
    await props.save({
      name: parsedName.data,
      category: category.value,
      currency: currency.value,
      accountId: accountId.value,
      date: parsedDate.data,
      amountMinor: Math.round(parsedAmount.data * 10 ** exponent),
      direction: direction.value,
    });
    resetForm();
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't add the one-off event.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard class="form-card">
    <h2>Add one-off</h2>
    <form class="form" @submit.prevent="onSubmit">
      <div class="grid">
        <BaseField label="Name" v-slot="{ id }">
          <BaseInput :id="id" v-model="name" required />
        </BaseField>

        <BaseField label="Category" v-slot="{ id }">
          <BaseSelect :id="id" v-model="category">
            <option v-for="c in SPEND_CATEGORIES" :key="c" :value="c">
              {{ ONE_OFF_CATEGORY_LABELS[c] }}
            </option>
          </BaseSelect>
        </BaseField>
      </div>

      <div class="grid">
        <BaseField label="Direction" v-slot="{ id }">
          <BaseSelect :id="id" v-model="direction">
            <option value="out">Money out</option>
            <option value="in">Money in</option>
          </BaseSelect>
        </BaseField>

        <BaseField label="Date" v-slot="{ id }">
          <BaseInput :id="id" v-model="date" type="date" required />
        </BaseField>
      </div>

      <div class="grid">
        <BaseField :label="direction === 'out' ? 'Paying from' : 'Paying into'" v-slot="{ id }">
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

      <BaseField label="Amount" v-slot="{ id }">
        <BaseInput
          :id="id"
          v-model="amount"
          type="number"
          :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
        />
      </BaseField>

      <div class="actions">
        <BaseButton type="submit" :disabled="saving">
          {{ saving ? 'Adding…' : 'Add one-off' }}
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
