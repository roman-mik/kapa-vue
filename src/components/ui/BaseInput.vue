<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: string;
    min?: number | string;
    max?: number | string;
    step?: number | string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
  }>(),
  { type: 'text', required: false, disabled: false }
);

const model = defineModel<string | number>();
</script>

<template>
  <input
    v-model="model"
    class="input"
    :type="type"
    :min="min"
    :max="max"
    :step="step"
    :placeholder="placeholder"
    :required="required"
    :disabled="disabled"
  />
</template>

<style scoped>
.input {
  font: inherit;
  padding: var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-bg);
  color: var(--kapa-ink);
  transition: border-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.input:focus-visible {
  outline: 2px solid var(--kapa-accent);
  outline-offset: 1px;
}

.input:disabled {
  opacity: 0.6;
}
</style>
