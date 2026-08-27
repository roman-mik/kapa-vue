<script setup lang="ts">
withDefaults(
  defineProps<{
    required?: boolean;
    disabled?: boolean;
  }>(),
  { required: false, disabled: false }
);

const model = defineModel<string>();
</script>

<template>
  <select v-model="model" class="select" :required="required" :disabled="disabled">
    <slot />
  </select>
</template>

<style scoped>
.select {
  font: inherit;
  padding: var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-bg);
  color: var(--kapa-ink);
}

.select:focus-visible {
  outline: 2px solid var(--kapa-accent);
  outline-offset: 1px;
}

.select:disabled {
  opacity: 0.6;
}
</style>
