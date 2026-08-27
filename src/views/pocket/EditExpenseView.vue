<script setup lang="ts">
import {
  convertToCurrency,
  CURRENCIES,
  CURRENCY_EXPONENT,
  type Currency,
  remainingAfter,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import { getExpense, type ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useCategories } from '@/composables/useCategories';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { supabase } from '@/lib/supabase';
import { firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';

const route = useRoute();
const router = useRouter();
const space = useSpaceStore();
const { categories } = useCategories({ includeArchived: true });
const { update } = useExpenses();
const { summary, rates } = usePocketHome();
const toast = useToast();

const expenseId = computed(() => route.params.id as string);

const original = ref<ExpenseView | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

const amount = ref('');
const currency = ref<Currency>('RSD');
const categoryId = ref<string>('');
const note = ref('');
const submitting = ref(false);
const submitError = ref<string | null>(null);

onMounted(async () => {
  loading.value = true;
  try {
    const expense = await getExpense(supabase, expenseId.value);
    if (!expense) {
      loadError.value = 'This expense no longer exists.';
      return;
    }
    original.value = expense;
    const exponent = CURRENCY_EXPONENT[(expense.currency ?? 'RSD') as Currency];
    amount.value = String((expense.amount_minor ?? 0) / 10 ** exponent);
    currency.value = (expense.currency ?? 'RSD') as Currency;
    categoryId.value = expense.category_id ?? '';
    note.value = expense.note ?? '';
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : "Couldn't load this expense.";
  } finally {
    loading.value = false;
  }
});

const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

// "Left after this" previews the edit as a replacement of the expense's
// current contribution, not an additional charge on top of it — the
// original amount is converted back into the space currency (as of its own
// date) and added back to `remaining` before the proposed new amount is
// subtracted. Null whenever a conversion has no covering fx rate, or the
// cap/summary hasn't loaded, rather than showing a misleading number.
const leftAfterThis = computed<number | null>(() => {
  const expense = original.value;
  const home = summary.value;
  if (!expense || !home) return null;

  const value = Number(amount.value);
  if (!Number.isFinite(value) || value < 0) return null;
  const proposedAmountMinor = Math.round(value * 10 ** exponent.value);

  const originalAsOfDate = expense.spent_at
    ? zonedDateKey(new Date(expense.spent_at), space.currentSpace?.timezone ?? 'UTC')
    : zonedDateKey(new Date(), space.currentSpace?.timezone ?? 'UTC');
  const originalContribution = convertToCurrency(
    expense.amount_minor ?? 0,
    (expense.currency ?? 'RSD') as Currency,
    home.currency,
    originalAsOfDate,
    rates.value
  );
  if (originalContribution === undefined) return null;

  const todayKey = zonedDateKey(new Date(), space.currentSpace?.timezone ?? 'UTC');
  const newContribution = convertToCurrency(
    proposedAmountMinor,
    currency.value,
    home.currency,
    todayKey,
    rates.value
  );
  if (newContribution === undefined) return null;

  return remainingAfter(home.remaining + originalContribution, newContribution);
});

async function onSubmit(): Promise<void> {
  submitError.value = null;
  const parsed = positiveAmountSchema.safeParse(amount.value);
  if (!parsed.success) {
    submitError.value = firstIssueMessage(parsed) ?? 'Enter a valid amount.';
    return;
  }
  submitting.value = true;
  try {
    await update(expenseId.value, {
      amount_minor: Math.round(parsed.data * 10 ** exponent.value),
      currency: currency.value,
      category_id: categoryId.value || null,
      note: note.value.trim() || null,
    });
    toast.success('Expense updated');
    await router.push({ name: 'pocket-history' });
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : "Couldn't save that expense.";
    toast.error(submitError.value);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="page">
    <h1>Edit expense</h1>

    <template v-if="loading">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="loadError" role="alert" class="error">{{ loadError }}</p>

    <form v-else class="form" @submit.prevent="onSubmit">
      <BaseField label="Amount" v-slot="{ id }">
        <BaseInput
          :id="id"
          v-model="amount"
          type="number"
          min="0"
          :step="exponent > 0 ? '0.01' : '1'"
          required
        />
      </BaseField>

      <BaseField label="Currency" v-slot="{ id }">
        <BaseSelect :id="id" v-model="currency">
          <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </BaseSelect>
      </BaseField>

      <BaseField label="Category" v-slot="{ id }">
        <BaseSelect :id="id" v-model="categoryId">
          <option value="">Uncategorized</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </BaseSelect>
      </BaseField>

      <BaseField label="Note" v-slot="{ id }">
        <BaseInput :id="id" v-model="note" type="text" />
      </BaseField>

      <p v-if="leftAfterThis !== null" class="hint" :class="{ negative: leftAfterThis < 0 }">
        {{ formatMoney(leftAfterThis, summary!.currency) }} left after this.
      </p>

      <p v-if="submitError" role="alert" class="error">{{ submitError }}</p>
      <BaseButton type="submit" block :disabled="submitting">
        {{ submitting ? 'Saving…' : 'Save' }}
      </BaseButton>
    </form>
  </main>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.hint {
  margin: 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.hint.negative {
  color: var(--kapa-negative);
  font-weight: 600;
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
