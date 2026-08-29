<script setup lang="ts">
import {
  convertToCurrency,
  CURRENCIES,
  CURRENCY_EXPONENT,
  type Currency,
  remainingAfter,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useCategories } from '@/composables/useCategories';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';

const space = useSpaceStore();
const { categories } = useCategories();
const { add } = useExpenses();
const { summary, rates } = usePocketHome();
const toast = useToast();
const router = useRouter();

const amount = ref('');
const currency = ref<Currency>((space.currentSpace?.currency ?? 'RSD') as Currency);
const categoryId = ref<string>('');
const note = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

// A zero-decimal currency (e.g. RSD) can't carry a fractional amount typed
// while a two-decimal currency was selected — truncate rather than leave a
// value the exponent can't represent.
watch(currency, () => {
  if (exponent.value === 0 && amount.value.includes('.')) {
    amount.value = amount.value.split('.')[0];
  }
});

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

function pressKey(key: string): void {
  if (key === '⌫') {
    amount.value = amount.value.slice(0, -1);
    return;
  }
  if (key === '.') {
    if (exponent.value === 0 || amount.value.includes('.')) return;
    amount.value = amount.value === '' ? '0.' : amount.value + '.';
    return;
  }
  const decimals = amount.value.split('.')[1];
  if (decimals !== undefined && decimals.length >= exponent.value) return;
  if (amount.value === '0') {
    amount.value = key;
  } else {
    amount.value += key;
  }
}

// Live "left after this" — converted into the space currency as of today,
// same rates the home screen already fetched. Null (hidden, not a wrong
// number) whenever there's no covering fx rate or the amount isn't valid yet.
const leftAfterThis = computed<number | null>(() => {
  const home = summary.value;
  const value = Number(amount.value);
  if (!home || !Number.isFinite(value) || value <= 0) return null;

  const amountMinor = Math.round(value * 10 ** exponent.value);
  const timeZone = space.currentSpace?.timezone ?? 'UTC';
  const todayKey = zonedDateKey(new Date(), timeZone);
  const converted = convertToCurrency(
    amountMinor,
    currency.value,
    home.currency,
    todayKey,
    rates.value
  );
  if (converted === undefined) return null;

  return remainingAfter(home.remaining, converted);
});

async function onSubmit(): Promise<void> {
  error.value = null;
  const parsed = positiveAmountSchema.safeParse(amount.value);
  if (!parsed.success) {
    error.value = firstIssueMessage(parsed) ?? 'Enter a valid amount.';
    return;
  }
  submitting.value = true;
  try {
    await add({
      amountMinor: Math.round(parsed.data * 10 ** exponent.value),
      currency: currency.value,
      categoryId: categoryId.value || null,
      note: note.value.trim() || null,
    });
    toast.success('Expense added');
    await router.push({ name: 'home' });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Couldn't add that expense.";
    toast.error(error.value);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="page">
    <h1>Add expense</h1>
    <form class="form" @submit.prevent="onSubmit">
      <div class="amount-display">{{ amount || '0' }}</div>

      <div class="keypad">
        <button
          v-for="key in KEYPAD_KEYS"
          :key="key"
          type="button"
          class="keypad-key"
          @click="pressKey(key)"
        >
          {{ key }}
        </button>
      </div>

      <div class="segmented" role="radiogroup" aria-label="Currency">
        <BaseButton
          v-for="c in CURRENCIES"
          :key="c"
          type="button"
          :variant="currency === c ? 'primary' : 'secondary'"
          @click="currency = c"
        >
          {{ c }}
        </BaseButton>
      </div>

      <div class="chips" role="radiogroup" aria-label="Category">
        <BaseButton
          type="button"
          :variant="categoryId === '' ? 'primary' : 'secondary'"
          @click="categoryId = ''"
        >
          Uncategorized
        </BaseButton>
        <BaseButton
          v-for="c in categories"
          :key="c.id"
          type="button"
          :variant="categoryId === c.id ? 'primary' : 'secondary'"
          @click="categoryId = c.id"
        >
          {{ c.name }}
        </BaseButton>
      </div>

      <BaseField label="Note" v-slot="{ id }">
        <BaseInput :id="id" v-model="note" type="text" />
      </BaseField>

      <p v-if="leftAfterThis !== null" class="hint" :class="{ negative: leftAfterThis < 0 }">
        {{ formatMoney(leftAfterThis, summary!.currency) }} left after this.
      </p>

      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <BaseButton type="submit" block :disabled="submitting">
        {{ submitting ? 'Adding…' : 'Add expense' }}
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

.amount-display {
  font-size: var(--kapa-text-display-size);
  font-weight: 700;
  text-align: center;
  padding: var(--kapa-space-3) 0;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--kapa-space-2);
}

.keypad-key {
  font: inherit;
  font-size: var(--kapa-text-title-size);
  padding: var(--kapa-space-3) 0;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
  transition: background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.keypad-key:hover {
  background: var(--kapa-neutral-200);
}

.segmented,
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
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
