<script setup lang="ts">
// Presentation only — callers pass already-formatted strings (formatMoney,
// etc.); this component has no arithmetic of its own.
withDefaults(
  defineProps<{
    value: string;
    label: string;
    tone?: 'default' | 'positive' | 'negative';
  }>(),
  { tone: 'default' }
);
</script>

<template>
  <div class="stat">
    <p class="value" :class="`tone-${tone}`">{{ value }}</p>
    <p class="label">{{ label }}</p>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.value {
  margin: 0;
  font-family: var(--font-heading);
  font-size: var(--kapa-text-display-size);
  line-height: calc(var(--kapa-text-display-line) / var(--kapa-text-display-size));
  font-weight: 400;
  letter-spacing: -0.015em;
  color: var(--kapa-ink);
}

.value.tone-positive {
  color: var(--kapa-positive-700);
}

.value.tone-negative {
  color: var(--kapa-negative);
}

.label {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}
</style>
