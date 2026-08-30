<script setup lang="ts">
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { formatMoney } from '@/lib/money';

defineProps<{
  accounts: Account[];
}>();
</script>

<template>
  <ul class="chips">
    <li v-for="account in accounts" :key="account.id" class="chip">
      <span class="name">{{ account.name }}</span>
      <span class="balance">{{
        formatMoney(account.current_balance_minor, account.currency as Currency)
      }}</span>
    </li>
  </ul>
</template>

<style scoped>
.chips {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
}

.chip {
  display: inline-flex;
  align-items: baseline;
  gap: var(--kapa-space-2);
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-xl);
  background: var(--kapa-surface);
  font-size: var(--kapa-text-caption-size);
}

.name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.balance {
  color: var(--kapa-ink-muted);
}
</style>
