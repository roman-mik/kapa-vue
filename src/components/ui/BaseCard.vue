<script setup lang="ts">
withDefaults(
  defineProps<{
    padding?: 'sm' | 'md';
  }>(),
  { padding: 'md' }
);
</script>

<template>
  <section class="card" :class="`pad-${padding}`">
    <slot />
  </section>
</template>

<style scoped>
.card {
  background: var(--kapa-surface);
  border-radius: var(--kapa-radius-md);
  box-shadow: var(--kapa-shadow-sm);
}

.pad-sm {
  padding: var(--kapa-space-4);
}

.pad-md {
  padding: var(--kapa-space-5);
}
</style>
