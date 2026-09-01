<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'confirmed' | 'expected' | 'uncertain' | 'in' | 'out' | 'neutral' | 'excluded';
  }>(),
  { variant: 'neutral' }
);
</script>

<template>
  <span class="badge" :class="`badge-${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.badge {
  display: inline-flex;
  align-items: center;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  line-height: 1;
  padding: 0 var(--kapa-space-2);
  border-radius: 999px;
  background: var(--kapa-neutral-400);
  color: var(--kapa-ink-muted);
}

.badge-confirmed {
  background: var(--kapa-positive-100);
  color: var(--kapa-positive-800);
}

.badge-expected {
  background: var(--kapa-accent-100);
  color: var(--kapa-accent-800);
}

.badge-uncertain {
  background: var(--kapa-neutral-200);
}

.badge-in {
  background: color-mix(in srgb, var(--kapa-positive) 20%, transparent);
  color: var(--kapa-positive);
}

.badge-out {
  background: color-mix(in srgb, var(--kapa-negative) 20%, transparent);
  color: var(--kapa-negative);
}

.badge-excluded {
  background: var(--kapa-neutral-200);
  color: var(--kapa-ink-muted);
}
</style>
