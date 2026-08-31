<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import type { Account, OneOffDirection, OneOffEvent } from '@roman-mik/kapa-core/horizon/queries';
import { computed, ref, watch } from 'vue';
import {
  ONE_OFF_CATEGORY_LABELS,
  SPEND_CATEGORIES,
  type NewOneOffEvent,
  type OneOffCategory,
  type OneOffEventEdit,
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
  /** When present the form edits this event instead of creating one. */
  initial?: OneOffEvent | null;
  save: (input: NewOneOffEvent) => Promise<void>;
  update?: (input: OneOffEventEdit) => Promise<void>;
  remove?: (id: string) => Promise<void>;
}>();

const emit = defineEmits<{ saved: []; cancelled: []; removed: [] }>();

const isEdit = computed(() => !!props.initial);

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

// Edit mode loads the event's values into the form (the row exists by the time
// the form mounts, so this can be synchronous).
watch(
  () => props.initial,
  (initial) => {
    if (!initial) return;
    name.value = initial.name;
    accountId.value = initial.account_id;
    category.value = (initial.category as OneOffCategory) ?? 'other';
    direction.value = (initial.direction as OneOffDirection) ?? 'out';
    currency.value = (initial.currency as Currency) ?? props.spaceCurrency;
    const exponent = CURRENCY_EXPONENT[currency.value] ?? 2;
    amount.value = String(initial.amount_minor / 10 ** exponent);
    date.value = initial.date;
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
    const input: NewOneOffEvent = {
      name: parsedName.data,
      category: category.value,
      currency: currency.value,
      accountId: accountId.value,
      date: parsedDate.data,
      amountMinor: Math.round(parsedAmount.data * 10 ** exponent),
      direction: direction.value,
    };
    if (props.initial && props.update) {
      await props.update({ ...input, id: props.initial.id });
    } else {
      await props.save(input);
    }
    resetForm();
    emit('saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save the one-off event.";
  } finally {
    saving.value = false;
  }
}

async function onRemove(): Promise<void> {
  if (!props.initial || !props.remove) return;
  saveError.value = null;
  saving.value = true;
  try {
    await props.remove(props.initial.id);
    resetForm();
    emit('removed');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't delete the one-off event.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseCard class="form-card">
    <h2>{{ isEdit ? 'Edit one-off' : 'Add one-off' }}</h2>
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
        <template v-if="isEdit">
          <BaseButton type="button" variant="danger" :disabled="saving" @click="onRemove">
            {{ saving ? 'Working…' : 'Delete' }}
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
