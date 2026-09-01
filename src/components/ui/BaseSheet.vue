<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    labelledBy?: string;
    dismissible?: boolean;
  }>(),
  { dismissible: true }
);

const emit = defineEmits<{ close: [] }>();

const panel = ref<HTMLElement | null>(null);
let previouslyFocused: HTMLElement | null = null;

function close(): void {
  if (props.dismissible) emit('close');
}

function onBackdropClick(event: MouseEvent): void {
  if (event.target === event.currentTarget) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    close();
    return;
  }
  if (event.key !== 'Tab' || !panel.value) return;
  const focusable = panel.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      previouslyFocused = document.activeElement as HTMLElement | null;
      await nextTick();
      const target = panel.value?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.value;
      target?.focus();
    } else {
      previouslyFocused?.focus();
      previouslyFocused = null;
    }
  },
  { immediate: true }
);
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="sheet-backdrop" @click="onBackdropClick" @keydown="onKeydown">
      <div
        ref="panel"
        class="sheet-panel"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="labelledBy"
        tabindex="-1"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: var(--kapa-sheet-backdrop, rgba(46, 43, 37, 0.32));
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 60;
}

.sheet-panel {
  background: var(--kapa-surface);
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  overflow-y: auto;
  border-radius: 20px 20px 0 0;
  box-shadow: var(--kapa-shadow-lg, var(--kapa-shadow-md));
  padding: var(--kapa-space-5) var(--kapa-space-4)
    calc(var(--kapa-space-5) + env(safe-area-inset-bottom, 0px));
}

.sheet-panel:focus {
  outline: none;
}

/* Desktop: centered modal card instead of a bottom sheet. */
@media (min-width: 760px) {
  .sheet-backdrop {
    align-items: center;
  }

  .sheet-panel {
    border-radius: var(--kapa-radius-md);
    max-height: 80vh;
    padding: var(--kapa-space-5);
  }
}
</style>
