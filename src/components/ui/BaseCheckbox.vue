<script setup lang="ts">
defineProps<{
  label: string;
}>();

const model = defineModel<boolean>();
</script>

<template>
  <label class="checkbox">
    <input v-model="model" type="checkbox" />
    <span>{{ label }}</span>
  </label>
</template>

<style scoped>
.checkbox {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
  font-size: var(--kapa-text-body-size);
  color: var(--kapa-ink);
  cursor: pointer;
}

.checkbox input {
  accent-color: var(--kapa-accent);
  width: 1.1em;
  height: 1.1em;
}
</style>
