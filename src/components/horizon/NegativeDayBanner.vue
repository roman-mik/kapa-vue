<script setup lang="ts">
import type { NegativeDayWarning } from '@roman-mik/kapa-core/horizon';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import { groupNegativeDayWarnings, type NegativeDaySpan } from '@/lib/horizon/negativeDaySpans';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';

const props = defineProps<{
  warnings: NegativeDayWarning[];
}>();

const emit = defineEmits<{
  dismiss: [dates: string[], reason: string];
  fix: [warning: NegativeDayWarning];
}>();

const spans = computed(() => groupNegativeDayWarnings(props.warnings));

// One reveal flag per span (keyed by start date), so each span's dismiss form
// can be opened independently without clobbering the others.
const dismissOpen = ref<Record<string, boolean>>({});

// One reason draft per span, so multiple spans can be mid-dismissal at once.
const reasonDrafts = ref<Record<string, string>>({});

function fixLabel(warning: NegativeDayWarning): string {
  return warning.fix.kind === 'shiftPayment'
    ? `Shift the ${warning.fix.event.label} payment`
    : `Hold back ${formatMoney(warning.fix.amountMinor, warning.currency as Currency)} before then`;
}

function rangeLabel(span: NegativeDaySpan): string {
  const { warnings } = span;
  if (warnings.length === 1) return formatFullDate(warnings[0].date);
  return `${formatFullDate(warnings[0].date)} – ${formatFullDate(
    warnings[warnings.length - 1].date
  )}`;
}

function shortfall(span: NegativeDaySpan): string {
  return formatMoney(-span.warnings[0].shortfallMinor, span.warnings[0].currency as Currency);
}

function toggleDismiss(startDate: string): void {
  dismissOpen.value[startDate] = !dismissOpen.value[startDate];
}

function submitDismiss(span: NegativeDaySpan, startDate: string): void {
  const reason = (reasonDrafts.value[startDate] ?? '').trim();
  if (!reason) return;
  emit(
    'dismiss',
    span.warnings.map((w) => w.date),
    reason
  );
  delete reasonDrafts.value[startDate];
  dismissOpen.value[startDate] = false;
}
</script>

<template>
  <div v-if="spans.length > 0" class="warnings" role="alert">
    <div v-for="span in spans" :key="span.startDate" class="warning">
      <div class="warning-body">
        <p class="message">
          <strong>{{ rangeLabel(span) }}</strong> goes {{ shortfall(span) }} negative.
          {{ fixLabel(span.warnings[0]) }}.
        </p>
        <div class="actions">
          <BaseButton
            v-if="span.warnings[0].fix.kind === 'shiftPayment'"
            @click="emit('fix', span.warnings[0])"
          >
            {{ fixLabel(span.warnings[0]) }}
          </BaseButton>
          <BaseButton variant="ghost" class="quiet" @click="toggleDismiss(span.startDate)">
            It's fine
          </BaseButton>
        </div>
      </div>

      <form
        v-if="dismissOpen[span.startDate]"
        class="dismiss-form"
        @submit.prevent="submitDismiss(span, span.startDate)"
      >
        <BaseInput
          v-model="reasonDrafts[span.startDate]"
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
  border-left: 4px solid var(--kapa-negative);
  background: color-mix(in srgb, var(--kapa-negative) 12%, var(--kapa-surface));
  color: var(--kapa-ink);
}

.warning-body {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.message {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
}

.actions .quiet {
  padding-inline: var(--kapa-space-2);
}

.dismiss-form {
  display: flex;
  gap: var(--kapa-space-2);
  margin-top: var(--kapa-space-2);
}

.dismiss-form :deep(.input) {
  flex: 1;
}
</style>
