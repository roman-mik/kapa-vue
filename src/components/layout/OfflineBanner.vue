<script setup lang="ts">
import { useOnlineStatus } from '@/composables/useOnlineStatus';

const { isOnline } = useOnlineStatus();
</script>

<template>
  <p v-if="!isOnline" role="status" class="offline-banner">
    You're offline — changes won't save until you're back online.
  </p>
</template>

<style scoped>
.offline-banner {
  margin: 0;
  padding: var(--kapa-space-2) var(--kapa-space-4);
  background: var(--kapa-negative);
  color: var(--kapa-white);
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  text-align: center;
}
</style>
