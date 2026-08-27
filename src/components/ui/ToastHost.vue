<script setup lang="ts">
import { useToast } from '@/composables/useToast';

const { toasts, dismiss } = useToast();
</script>

<template>
  <div class="toast-host" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div
        v-for="t in toasts"
        :key="t.id"
        class="toast"
        :class="`tone-${t.tone}`"
        @click="dismiss(t.id)"
      >
        {{ t.text }}
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(var(--kapa-space-7) + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--kapa-space-2);
  padding: 0 var(--kapa-space-4);
  z-index: 50;
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  max-width: 420px;
  padding: var(--kapa-space-3) var(--kapa-space-4);
  border-radius: var(--kapa-radius-sm);
  box-shadow: var(--kapa-shadow-md);
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-white);
  cursor: pointer;
  background: var(--kapa-ink);
}

.toast.tone-success {
  background: var(--kapa-positive-700);
}

.toast.tone-error {
  background: var(--kapa-negative);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity var(--kapa-motion-base) var(--kapa-motion-ease),
    transform var(--kapa-motion-base) var(--kapa-motion-ease);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
