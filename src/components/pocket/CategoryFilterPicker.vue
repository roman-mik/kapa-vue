<script setup lang="ts">
import type { Category } from '@roman-mik/kapa-core/core';
import { computed, nextTick, onUnmounted, ref, useId, watch } from 'vue';
import BaseSheet from '@/components/ui/BaseSheet.vue';

const props = defineProps<{ categories: Category[]; modelValue: string; spaceId: string | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();
const id = useId();
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const search = ref('');
const media = window.matchMedia('(min-width: 760px)');
const desktop = ref(media.matches);
const selectedName = computed(() =>
  props.modelValue === 'all'
    ? 'All'
    : props.modelValue === ''
      ? 'Uncategorized'
      : (props.categories.find((c) => c.id === props.modelValue)?.name ?? 'Unavailable category')
);
const options = computed(() => [
  { id: 'all', name: 'All categories', archived: false },
  ...('uncategorized'.includes(search.value.trim().toLocaleLowerCase())
    ? [{ id: '', name: 'Uncategorized', archived: false }]
    : []),
  ...props.categories
    .filter((c) => c.name.toLocaleLowerCase().includes(search.value.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name)),
]);
async function close(restore = true) {
  open.value = false;
  if (restore) {
    await nextTick();
    trigger.value?.focus();
  }
}
async function toggle() {
  if (open.value) {
    await close();
    return;
  }
  search.value = '';
  open.value = true;
  await nextTick();
  document.getElementById(`${id}-search`)?.focus();
}
function select(value: string) {
  emit('update:modelValue', value);
  void close();
}
function navigate(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  if (event.target instanceof HTMLInputElement && !['ArrowDown', 'ArrowUp'].includes(event.key))
    return;
  const buttons = Array.from(
    document.getElementById(`${id}-options`)?.querySelectorAll<HTMLButtonElement>('button') ?? []
  );
  if (!buttons.length) return;
  event.preventDefault();
  const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : event.key === 'ArrowDown'
          ? (index + 1) % buttons.length
          : index < 0
            ? buttons.length - 1
            : (index - 1 + buttons.length) % buttons.length;
  buttons[next]?.focus();
}
function focusOutside(event: FocusEvent) {
  if (desktop.value && open.value && !root.value?.contains(event.target as Node)) void close(false);
}
function outside(event: PointerEvent) {
  if (desktop.value && open.value && !root.value?.contains(event.target as Node)) void close(false);
}
function breakpoint(event: MediaQueryListEvent) {
  void close();
  desktop.value = event.matches;
}
media.addEventListener('change', breakpoint);
document.addEventListener('pointerdown', outside);
document.addEventListener('focusin', focusOutside);
watch(
  () => props.spaceId,
  () => {
    void close();
  }
);
onUnmounted(() => {
  media.removeEventListener('change', breakpoint);
  document.removeEventListener('pointerdown', outside);
  document.removeEventListener('focusin', focusOutside);
});
</script>

<template>
  <div ref="root" class="category-picker" @keydown.esc.stop.prevent="close()">
    <button
      ref="trigger"
      type="button"
      class="category-trigger"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      :aria-label="`Category: ${selectedName}`"
      @click="toggle"
    >
      <span class="selected-name">Category: {{ selectedName }}</span
      ><span aria-hidden="true">▾</span>
    </button>
    <component
      :is="desktop ? 'div' : BaseSheet"
      v-if="open"
      :open="open"
      :labelled-by="`${id}-title`"
      v-bind="desktop ? { class: 'category-popover' } : {}"
      @close="close()"
    >
      <div
        :id="`${id}-panel`"
        :role="desktop ? 'dialog' : undefined"
        :aria-labelledby="desktop ? `${id}-title` : undefined"
        @keydown="navigate"
        @keydown.esc.stop.prevent="close()"
      >
        <div class="picker-heading">
          <h2 :id="`${id}-title`">Filter by category</h2>
          <button type="button" aria-label="Close category picker" @click="close()">✕</button>
        </div>
        <label :for="`${id}-search`">Search categories</label>
        <input
          :id="`${id}-search`"
          v-model="search"
          data-autofocus
          type="search"
          autocomplete="off"
          class="category-search"
        />
        <div :id="`${id}-options`" class="category-options" role="group" aria-label="Categories">
          <button
            v-for="option in options"
            :key="option.id"
            type="button"
            :aria-pressed="modelValue === option.id"
            @click="select(option.id)"
          >
            <span class="option-name"
              >{{ option.name }}<small v-if="option.archived">Archived</small></span
            ><span v-if="modelValue === option.id" aria-hidden="true">✓</span>
          </button>
          <p v-if="options.length === 1" role="status">No matching categories</p>
        </div>
      </div>
    </component>
    <span class="sr-only" role="status">Category: {{ selectedName }}</span>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.category-picker {
  position: relative;
  min-width: 0;
  flex: 1;
  max-width: 360px;
}
.category-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-2);
  width: 100%;
  min-height: 44px;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-sm);
  color: var(--kapa-ink);
  font: inherit;
  cursor: pointer;
}
.selected-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.category-popover {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: min(360px, calc(100vw - 48px));
  padding: var(--kapa-space-4);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  background: var(--kapa-surface);
  box-shadow: var(--kapa-shadow-md);
  z-index: 60;
}
.picker-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-2);
}
.picker-heading h2 {
  margin: 0 0 var(--kapa-space-3);
  font-size: var(--kapa-text-body-size);
}
.picker-heading button {
  min-width: 44px;
  min-height: 44px;
}
.category-search {
  display: block;
  box-sizing: border-box;
  width: 100%;
  margin: var(--kapa-space-2) 0;
  min-height: 44px;
  font: inherit;
}
.category-options {
  max-height: min(320px, 40dvh);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.category-options button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-2);
  min-height: 44px;
  padding: var(--kapa-space-2);
  text-align: left;
  font: inherit;
  color: var(--kapa-ink);
  background: transparent;
  border: 0;
  cursor: pointer;
}
.category-options button[aria-pressed='true'] {
  background: var(--kapa-neutral-200);
  font-weight: 600;
}
.option-name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.option-name small {
  display: block;
  color: var(--kapa-ink-muted);
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--kapa-accent);
  outline-offset: 2px;
}
</style>
