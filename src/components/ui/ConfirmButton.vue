<script setup lang="ts">
import { onUnmounted, ref } from 'vue';

// Two-step destructive confirm: first click arms it and shows `confirmLabel`
// for a few seconds; a second click within that window emits `confirm`. Any
// other interaction (or the window elapsing) disarms it back to `label` —
// callers never need their own confirm-dialog state.
const props = withDefaults(
  defineProps<{
    label: string;
    confirmLabel?: string;
    disabled?: boolean;
    armedMs?: number;
  }>(),
  { confirmLabel: 'Confirm?', disabled: false, armedMs: 3000 }
);

const emit = defineEmits<{ confirm: [] }>();

const armed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

function disarm(): void {
  armed.value = false;
  clearTimeout(timer);
}

function onClick(): void {
  if (props.disabled) return;
  if (armed.value) {
    disarm();
    emit('confirm');
    return;
  }
  armed.value = true;
  timer = setTimeout(disarm, props.armedMs);
}

onUnmounted(() => clearTimeout(timer));
</script>

<template>
  <button
    type="button"
    class="confirm-btn"
    :class="{ armed }"
    :disabled="disabled"
    @click="onClick"
    @blur="disarm"
  >
    {{ armed ? confirmLabel : label }}
  </button>
</template>

<style scoped>
.confirm-btn {
  font: inherit;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: transparent;
  color: var(--kapa-ink-muted);
  cursor: pointer;
  transition:
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    color var(--kapa-motion-fast) var(--kapa-motion-ease),
    border-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.confirm-btn.armed {
  background: var(--kapa-negative);
  border-color: var(--kapa-negative);
  color: var(--kapa-white);
}
</style>
