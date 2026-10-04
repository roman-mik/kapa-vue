<script setup lang="ts">
import { computed } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
const props = withDefaults(defineProps<{ issues?: string[] }>(), { issues: () => [] });
const sheet = usePaymentLinkSheet();
const emit = defineEmits<{ inspect: [] }>();
function inspect() {
  emit('inspect');
  sheet.open();
}
const reasons = computed(() => [
  ...new Set(
    props.issues.map((issue) =>
      issue.includes('balance for account')
        ? 'Some accounts need a checked balance.'
        : issue.includes('allowance') || issue.includes('spending budget')
          ? 'Review whether planned bills overlap your everyday allowance.'
          : issue.includes('historical')
            ? 'Some historical balances are unknown.'
            : 'Some recorded spending or payments need account and balance-inclusion review.'
    )
  ),
]);
</script>
<template>
  <section v-if="issues.length" class="cash-review" aria-label="Cashflow needs review">
    <h2>Cashflow needs review</h2>
    <p>
      These balances are estimates with unresolved movements. Review them before deciding what you
      can afford.
    </p>
    <ul>
      <li v-for="reason in reasons" :key="reason">{{ reason }}</li>
    </ul>
    <BaseButton variant="secondary" @click="inspect">Review payments and balances</BaseButton>
  </section>
</template>
<style scoped>
.cash-review {
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  padding: var(--kapa-space-4);
  margin-bottom: var(--kapa-space-4);
}
h2 {
  font-size: var(--kapa-text-body-size);
  margin: 0 0 var(--kapa-space-2);
}
p {
  margin: 0;
}
</style>
