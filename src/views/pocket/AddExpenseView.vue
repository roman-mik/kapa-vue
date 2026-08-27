<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import { useCategories } from '@/composables/useCategories';
import { useExpenses } from '@/composables/useExpenses';
import { useToast } from '@/composables/useToast';
import { useSpaceStore } from '@/stores/space';

const space = useSpaceStore();
const { categories } = useCategories();
const { add } = useExpenses();
const toast = useToast();
const router = useRouter();

const amount = ref('');
const currency = ref<Currency>((space.currentSpace?.currency ?? 'RSD') as Currency);
const categoryId = ref<string>('');
const note = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);

const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

async function onSubmit(): Promise<void> {
  error.value = null;
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) {
    error.value = 'Enter a valid amount.';
    return;
  }
  submitting.value = true;
  try {
    await add({
      amountMinor: Math.round(value * 10 ** exponent.value),
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

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
