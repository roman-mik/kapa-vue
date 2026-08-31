<script setup lang="ts">
import type { NegativeDayWarning } from '@roman-mik/kapa-core/horizon';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { ref } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';

const props = defineProps<{
  warnings: NegativeDayWarning[];
}>();

const emit = defineEmits<{ dismiss: [date: string, reason: string] }>();

// One reason draft per open date, so multiple banners can be mid-dismissal
// at once without clobbering each other.
const reasonDrafts = ref<Record<string, string>>({});

function fixLabel(warning: NegativeDayWarning): string {
  return warning.fix.kind === 'shiftPayment'
    ? `Shift the ${warning.fix.event.label} payment`
    : `Hold back ${formatMoney(warning.fix.amountMinor, warning.currency as Currency)} before then`;
}

function submitDismiss(warning: NegativeDayWarning): void {
  const reason = (reasonDrafts.value[warning.date] ?? '').trim();
  if (!reason) return;
  emit('dismiss', warning.date, reason);
  delete reasonDrafts.value[warning.date];
}
</script>

<template>
  <div v-if="props.warnings.length > 0" class="warnings" role="alert">
    <div v-for="warning in props.warnings" :key="warning.date" class="warning">
      <p class="message">
        <strong>{{ formatFullDate(warning.date) }}</strong> goes
        {{ formatMoney(-warning.shortfallMinor, warning.currency as Currency) }} negative.
        {{ fixLabel(warning) }}.
      </p>
      <form class="dismiss-form" @submit.prevent="submitDismiss(warning)">
        <BaseInput
          v-model="reasonDrafts[warning.date]"
          placeholder="Why is this OK to dismiss?"
          required
        />
        <BaseButton type="submit" variant="secondary">Dismiss</BaseButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.warnings {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.warning {
  padding: var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  background: var(--kapa-negative);
  color: var(--kapa-white);
}

.message {
  margin: 0 0 var(--kapa-space-2);
}

.dismiss-form {
  display: flex;
  gap: var(--kapa-space-2);
}

.dismiss-form :deep(.input) {
  flex: 1;
}
</style>
