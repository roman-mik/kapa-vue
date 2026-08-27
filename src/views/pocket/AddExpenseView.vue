<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from "@roman-mik/kapa-core/pocket";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { useCategories } from "@/composables/useCategories";
import { useExpenses } from "@/composables/useExpenses";
import { useSpaceStore } from "@/stores/space";

const space = useSpaceStore();
const { categories } = useCategories();
const { add } = useExpenses();
const router = useRouter();

const amount = ref("");
const currency = ref<Currency>((space.currentSpace?.currency ?? "RSD") as Currency);
const categoryId = ref<string>("");
const note = ref("");
const submitting = ref(false);
const error = ref<string | null>(null);

const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

async function onSubmit(): Promise<void> {
  error.value = null;
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) {
    error.value = "Enter a valid amount.";
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
    await router.push({ name: "home" });
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Couldn't add that expense.";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="add-expense">
    <h1>Add expense</h1>
    <form @submit.prevent="onSubmit">
      <label>
        Amount
        <input
          v-model="amount"
          type="number"
          min="0"
          :step="exponent > 0 ? '0.01' : '1'"
          required
        />
      </label>
      <label>
        Currency
        <select v-model="currency">
          <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>
      <label>
        Category
        <select v-model="categoryId">
          <option value="">Uncategorized</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <label>
        Note
        <input v-model="note" type="text" />
      </label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <button type="submit" :disabled="submitting">
        {{ submitting ? "Adding…" : "Add expense" }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.add-expense {
  max-width: 420px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--kapa-ink-muted);
}

input,
select {
  font: inherit;
  padding: 0.5rem 0.75rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

button {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--kapa-radius-sm);
  border: none;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
