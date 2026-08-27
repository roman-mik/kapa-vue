<script setup lang="ts">
import {
  CURRENCY_EXPONENT,
  type Currency,
  remaining,
  safeDaily,
} from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { usePocketHome } from '@/composables/usePocketHome';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { firstIssueMessage, nonNegativeAmountSchema, nudgePctSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';

const space = useSpaceStore();
const { cap: capApi, summary, loading, error } = usePocketHome();
const cap = capApi.cap;
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

// Live preview of what the *proposed* (not-yet-saved) cap amount implies,
// so the consequence panel updates as the user types — before Save, not
// after. Independent of the actually-saved cap; spentThisMonth doesn't
// change with the proposal.
const consequence = computed(() => {
  const amount = Number(capAmount.value);
  if (!Number.isFinite(amount) || amount < 0 || !summary.value) return null;
  const proposedCapMinor = Math.round(amount * 10 ** exponent.value);
  const spent = summary.value.spent;
  const remainingValue = remaining(proposedCapMinor, spent);
  const daily = safeDaily(remainingValue, summary.value.daysUntilReset);
  return { alreadySpent: spent, safeDaily: daily, safeWeekly: daily * 7 };
});

async function onSubmit(): Promise<void> {
  saveError.value = null;
  const parsedAmount = nonNegativeAmountSchema.safeParse(capAmount.value);
  if (!parsedAmount.success) {
    saveError.value = firstIssueMessage(parsedAmount) ?? 'Enter a valid amount.';
    return;
  }
  if (nudgeEnabled.value) {
    const parsedPct = nudgePctSchema.safeParse(nudgePct.value);
    if (!parsedPct.success) {
      saveError.value = firstIssueMessage(parsedPct) ?? 'Enter a value between 1 and 100.';
      return;
    }
  }
  saving.value = true;
  try {
    await capApi.setCap({
      monthlyCapMinor: Math.round(parsedAmount.data * 10 ** exponent.value),
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

      <BaseCard v-if="consequence" padding="sm">
        <ul class="consequence">
          <li>
            <span>Already spent this month</span>
            <span>{{ formatMoney(consequence.alreadySpent, currency) }}</span>
          </li>
          <li>
            <span>Safe to spend per day</span>
            <span :class="{ negative: consequence.safeDaily < 0 }">{{
              formatMoney(consequence.safeDaily, currency)
            }}</span>
          </li>
          <li>
            <span>Safe to spend per week</span>
            <span :class="{ negative: consequence.safeWeekly < 0 }">{{
              formatMoney(consequence.safeWeekly, currency)
            }}</span>
          </li>
        </ul>
      </BaseCard>

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

.consequence {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
  font-size: var(--kapa-text-caption-size);
}

.consequence li {
  display: flex;
  justify-content: space-between;
}

.consequence .negative {
  color: var(--kapa-negative);
  font-weight: 600;
}
</style>
