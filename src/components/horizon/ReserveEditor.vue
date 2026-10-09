<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { setReserve } from '@roman-mik/kapa-core/horizon/queries';
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { useHorizonSettingsResource } from '@/composables/useHorizonSettingsResource';
import { useSpaceStore } from '@/stores/space';
import { supabase } from '@/lib/supabase';
import BaseButton from '@/components/ui/BaseButton.vue';
const settings = useHorizonSettingsResource();
const space = useSpaceStore();
const amount = ref('');
const dirty = ref(false);
const saving = ref(false);
const error = ref('');
const currency = computed(() => (settings.data.value?.reporting_currency ?? 'RSD') as Currency);
watch(
  () => space.currentSpaceId,
  () => {
    amount.value = '';
    dirty.value = false;
    error.value = '';
  }
);
watch(
  settings.data,
  (value) => {
    if (!dirty.value)
      amount.value =
        value?.reserve_minor == null
          ? ''
          : String(
              value.reserve_minor /
                10 ** CURRENCY_EXPONENT[(value.reserve_currency ?? currency.value) as Currency]
            );
  },
  { immediate: true }
);
async function save(clear = false) {
  const spaceId = space.currentSpaceId;
  if (!spaceId || saving.value) return;
  const minor = Math.round(Number(amount.value) * 10 ** CURRENCY_EXPONENT[currency.value]);
  if (
    !clear &&
    (!amount.value.trim() ||
      !Number.isSafeInteger(minor) ||
      minor < 0 ||
      !/^\d+(\.\d+)?$/.test(amount.value) ||
      (amount.value.split('.')[1]?.length ?? 0) > CURRENCY_EXPONENT[currency.value])
  ) {
    error.value = 'Enter a nonnegative amount with the currency’s decimal places.';
    return;
  }
  const invalidate = settings.invalidate;
  saving.value = true;
  error.value = '';
  try {
    await setReserve(
      supabase,
      spaceId,
      clear ? null : { amountMinor: minor, currency: currency.value }
    );
    await invalidate();
    if (space.currentSpaceId === spaceId) {
      dirty.value = false;
      if (clear) amount.value = '';
    }
  } catch (err) {
    if (space.currentSpaceId === spaceId)
      error.value = err instanceof Error ? err.message : 'Could not save reserve.';
  } finally {
    saving.value = false;
  }
}
</script>
<template>
  <section id="reserve" aria-labelledby="reserve-title">
    <h2 id="reserve-title">Cash reserve</h2>
    <p>
      A shared cash floor for included accounts. This does not move money or create a savings
      expense.
    </p>
    <p v-if="settings.data.value?.reserve_minor == null">No reserve set; the cash floor is zero.</p>
    <p v-else-if="settings.data.value.reserve_currency !== currency" role="status">
      The reserve is in {{ settings.data.value.reserve_currency }}. Set it again in
      {{ currency }} or clear it before assessing reserve coverage.
    </p>
    <form @submit.prevent="save()">
      <label
        >Reserve ({{ currency }})
        <input v-model="amount" :disabled="saving" inputmode="decimal" @input="dirty = true"
      /></label>
      <p v-if="error" role="alert">{{ error }}</p>
      <BaseButton type="submit" :disabled="saving || settings.loading.value"
        >Save reserve</BaseButton
      >
      <BaseButton
        type="button"
        variant="secondary"
        :disabled="saving || settings.loading.value"
        @click="save(true)"
        >Clear reserve</BaseButton
      >
    </form>
  </section>
</template>
<style scoped>
section {
  overflow-wrap: anywhere;
}
label {
  display: block;
  margin-block: var(--kapa-space-3);
}
input {
  display: block;
  max-width: 100%;
  min-height: 44px;
  padding: var(--kapa-space-2);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  border: 1px solid var(--kapa-neutral-400);
}
button {
  margin: var(--kapa-space-2);
}
input:focus-visible {
  outline: 2px solid var(--kapa-ink);
  outline-offset: 2px;
}
</style>
