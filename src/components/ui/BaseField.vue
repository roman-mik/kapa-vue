<script setup lang="ts">
import { useId } from 'vue';

defineProps<{
  label: string;
  error?: string | null;
  hint?: string;
}>();

// Exposed via the default slot's scope so the input inside can bind
// :id="id" and get free label association without every caller inventing
// its own id.
const id = useId();
</script>

<template>
  <label class="field" :for="id">
    <span class="label">{{ label }}</span>
    <slot :id="id" />
    <span v-if="error" role="alert" class="error">{{ error }}</span>
    <span v-else-if="hint" class="hint">{{ hint }}</span>
  </label>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.label {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
}

.error {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-negative);
}

.hint {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-subtle);
}
</style>
