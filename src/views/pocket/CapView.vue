<script setup lang="ts">
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useCap } from '@/composables/useCap';
import { useToast } from '@/composables/useToast';
import { useSpaceStore } from '@/stores/space';

const space = useSpaceStore();
const { cap, loading, error, setCap } = useCap();
const toast = useToast();

const currency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);
const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

const capAmount = ref('');
const nudgeEnabled = ref(true);
const nudgePct = ref(80);
const saving = ref(false);
const saveError = ref<string | null>(null);

// Mirrors the loaded cap into the form fields whenever it (re)loads —
// editing always starts from what's actually saved, not a blank slate.
watch(
  cap,
  (value) => {
    capAmount.value = value ? String(value.monthly_cap_minor / 10 ** exponent.value) : '';
    nudgeEnabled.value = value?.nudge_enabled ?? true;
    nudgePct.value = value?.nudge_pct ?? 80;
  },
  { immediate: true }
);

async function onSubmit(): Promise<void> {
  saveError.value = null;
  const amount = Number(capAmount.value);
  if (!Number.isFinite(amount) || amount < 0) {
    saveError.value = 'Enter a valid amount.';
    return;
  }
  saving.value = true;
  try {
    await setCap({
      monthlyCapMinor: Math.round(amount * 10 ** exponent.value),
      nudgeEnabled: nudgeEnabled.value,
      nudgePct: nudgePct.value,
    });
    toast.success('Cap saved');
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save the cap.";
    toast.error(saveError.value);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <main class="page">
    <h1>Monthly cap</h1>

    <template v-if="loading && !cap">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <form v-else class="form" @submit.prevent="onSubmit">
      <BaseField :label="`Cap (${currency})`" v-slot="{ id }">
        <BaseInput
          :id="id"
          v-model="capAmount"
          type="number"
          min="0"
          :step="exponent > 0 ? '0.01' : '1'"
          required
        />
      </BaseField>

      <BaseCheckbox v-model="nudgeEnabled" label="Warn me as I approach the cap" />

      <BaseField v-if="nudgeEnabled" label="Warn at (% of cap)" v-slot="{ id }">
        <BaseInput :id="id" v-model.number="nudgePct" type="number" min="1" max="100" required />
      </BaseField>

      <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>
      <BaseButton type="submit" block :disabled="saving">{{
        saving ? 'Saving…' : 'Save'
      }}</BaseButton>
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
