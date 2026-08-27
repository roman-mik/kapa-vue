<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    type?: 'button' | 'submit';
    disabled?: boolean;
    block?: boolean;
  }>(),
  {
    variant: 'primary',
    type: 'button',
    disabled: false,
    block: false,
  }
);
</script>

<template>
  <button :type="type" :disabled="disabled" class="btn" :class="[`btn-${variant}`, { block }]">
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--kapa-space-2);
  font: inherit;
  font-weight: 600;
  padding: var(--kapa-space-3) var(--kapa-space-4);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid transparent;
  cursor: pointer;
  transition:
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    border-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    opacity var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn.block {
  display: flex;
  width: 100%;
}

.btn-primary {
  background: var(--kapa-accent);
  color: var(--kapa-white);
}

.btn-primary:not(:disabled):hover {
  background: var(--kapa-accent-600);
}

.btn-secondary {
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  border-color: var(--kapa-neutral-400);
}

.btn-secondary:not(:disabled):hover {
  background: var(--kapa-neutral-200);
}

.btn-ghost {
  background: transparent;
  color: var(--kapa-ink-muted);
  border-color: transparent;
}

.btn-ghost:not(:disabled):hover {
  background: var(--kapa-neutral-200);
  color: var(--kapa-ink);
}

.btn-danger {
  background: var(--kapa-negative);
  color: var(--kapa-white);
}

.btn-danger:not(:disabled):hover {
  opacity: 0.9;
}
</style>
