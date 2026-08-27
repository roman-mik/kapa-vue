<script setup lang="ts">
import { CURRENCY_EXPONENT, type Currency } from "@roman-mik/kapa-core/pocket";
import { computed, ref, watch } from "vue";
import { useCap } from "@/composables/useCap";
import { useSpaceStore } from "@/stores/space";

const space = useSpaceStore();
const { cap, loading, error, setCap } = useCap();

const currency = computed<Currency>(() => (space.currentSpace?.currency ?? "RSD") as Currency);
const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

const capAmount = ref("");
const nudgeEnabled = ref(true);
const nudgePct = ref(80);
const saving = ref(false);
const saveError = ref<string | null>(null);

// Mirrors the loaded cap into the form fields whenever it (re)loads —
// editing always starts from what's actually saved, not a blank slate.
watch(
  cap,
  (value) => {
    capAmount.value = value ? String(value.monthly_cap_minor / 10 ** exponent.value) : "";
    nudgeEnabled.value = value?.nudge_enabled ?? true;
    nudgePct.value = value?.nudge_pct ?? 80;
  },
  { immediate: true },
);

async function onSubmit(): Promise<void> {
  saveError.value = null;
  const amount = Number(capAmount.value);
  if (!Number.isFinite(amount) || amount < 0) {
    saveError.value = "Enter a valid amount.";
    return;
  }
  saving.value = true;
  try {
    await setCap({
      monthlyCapMinor: Math.round(amount * 10 ** exponent.value),
      nudgeEnabled: nudgeEnabled.value,
      nudgePct: nudgePct.value,
    });
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save the cap.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="cap">
    <h1>Monthly cap</h1>
    <p v-if="loading && !cap">Loading…</p>
    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <form v-else @submit.prevent="onSubmit">
      <label>
        Cap ({{ currency }})
        <input
          v-model="capAmount"
          type="number"
          min="0"
          :step="exponent > 0 ? '0.01' : '1'"
          required
        />
      </label>
      <label class="checkbox">
        <input v-model="nudgeEnabled" type="checkbox" />
        Warn me as I approach the cap
      </label>
      <label v-if="nudgeEnabled">
        Warn at (% of cap)
        <input v-model.number="nudgePct" type="number" min="1" max="100" required />
      </label>
      <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>
      <button type="submit" :disabled="saving">{{ saving ? "Saving…" : "Save" }}</button>
    </form>
  </main>
</template>

<style scoped>
.cap {
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

label.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

input[type="number"] {
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
