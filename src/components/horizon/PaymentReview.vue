<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { formatFullDate } from '@/lib/date';
import type { PaymentReviewTarget } from '@/lib/horizon/paymentReview';

const props = defineProps<{
  target: PaymentReviewTarget;
  loading: boolean;
  error?: string | null;
  found: boolean;
  recurring: boolean;
}>();
defineEmits<{ close: [] }>();
const panel = ref<HTMLElement | null>(null);
watch(
  () => [props.target.id, props.found, props.loading, props.error],
  async () => {
    await nextTick();
    const focus = panel.value?.querySelector<HTMLElement>('input, select, h2');
    focus?.focus();
    focus?.scrollIntoView?.({ block: 'nearest' });
  },
  { immediate: true }
);
</script>

<template>
  <section ref="panel" class="payment-review" aria-labelledby="payment-review-heading">
    <h2 id="payment-review-heading" tabindex="-1">Review payment</h2>
    <p v-if="/^\d{4}-\d{2}-\d{2}$/.test(target.date)">
      From the warning for {{ formatFullDate(target.date) }}.
    </p>
    <p v-if="loading" role="status">Loading payment…</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <template v-else-if="found">
      <p v-if="recurring">
        This edits the recurring source and its future payments. It does not move just this payment.
      </p>
      <slot />
    </template>
    <p v-else role="status">
      This source is unavailable or cannot be edited here. Review the Money list below.
    </p>
    <BaseButton variant="secondary" @click="$emit('close')">Back to Money list</BaseButton>
  </section>
</template>

<style scoped>
.payment-review {
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  padding: var(--kapa-space-4);
  margin-bottom: var(--kapa-space-4);
  overflow-wrap: anywhere;
}
.payment-review :deep(.edit-form) {
  margin-block: var(--kapa-space-3);
}
</style>
