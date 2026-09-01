<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import type { RowMenuAction } from './expenseRowMenu';

const props = defineProps<{
  actions: RowMenuAction[];
  triggerLabel?: string;
}>();

const emit = defineEmits<{ select: [id: string]; confirm: [id: string] }>();

const open = ref(false);
const root = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function close(): void {
  open.value = false;
}

function onSelect(action: RowMenuAction): void {
  if (action.disabled) return;
  close();
  emit('select', action.id);
}

function onConfirm(action: RowMenuAction): void {
  close();
  emit('confirm', action.id);
}

function onDocumentClick(event: MouseEvent): void {
  if (root.value && !root.value.contains(event.target as Node)) close();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') close();
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('click', onDocumentClick);
    document.addEventListener('keydown', onKeydown);
  } else {
    document.removeEventListener('click', onDocumentClick);
    document.removeEventListener('keydown', onKeydown);
  }
});

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick);
  document.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <div ref="root" class="row-menu">
    <button
      type="button"
      class="row-menu-trigger"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="triggerLabel ?? 'Actions'"
      @click="toggle"
    >
      &#8943;
    </button>
    <ul v-if="open" role="menu" class="row-menu-list">
      <li v-for="action in props.actions" :key="action.id" role="none">
        <ConfirmButton
          v-if="action.kind === 'confirm'"
          role="menuitem"
          class="row-menu-item"
          :label="action.label"
          :confirm-label="action.confirmLabel ?? 'Confirm?'"
          :armed-ms="action.armedMs"
          :disabled="action.disabled"
          @confirm="onConfirm(action)"
        />
        <button
          v-else
          type="button"
          role="menuitem"
          class="row-menu-item"
          :disabled="action.disabled"
          @click="onSelect(action)"
        >
          {{ action.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.row-menu {
  position: relative;
  display: inline-flex;
}

.row-menu-trigger {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  line-height: 1;
  border: 1px solid transparent;
  border-radius: var(--kapa-radius-sm);
  background: transparent;
  color: var(--kapa-ink-muted);
  cursor: pointer;
}

.row-menu-trigger:hover {
  background: var(--kapa-neutral-200);
  color: var(--kapa-ink);
}

.row-menu-list {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 10;
  margin: var(--kapa-space-1) 0 0;
  padding: var(--kapa-space-1);
  min-width: 160px;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
  list-style: none;
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-sm);
  box-shadow: var(--kapa-shadow-md);
}

.row-menu-item {
  width: 100%;
  text-align: left;
  font: inherit;
  font-weight: 600;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  color: var(--kapa-ink);
  cursor: pointer;
}

.row-menu-item:hover:not(:disabled) {
  background: var(--kapa-neutral-200);
}

.row-menu-item:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
