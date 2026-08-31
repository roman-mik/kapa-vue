<script setup lang="ts">
import { EVENT_ORDER_KINDS, type EventOrder } from '@roman-mik/kapa-core/horizon/queries';
import { computed } from 'vue';

const props = defineProps<{
  modelValue: EventOrder;
}>();

const emit = defineEmits<{ 'update:modelValue': [value: EventOrder] }>();

const LABELS: Record<(typeof EVENT_ORDER_KINDS)[number], string> = {
  income: 'Income',
  oneOffIn: 'One-off in',
  obligation: 'Obligations',
  plannedSpend: 'Planned spend',
  oneOffOut: 'One-off out',
};

const kinds = computed<(typeof EVENT_ORDER_KINDS)[number][]>(
  () => props.modelValue.split(',') as (typeof EVENT_ORDER_KINDS)[number][]
);

function toOrder(ordered: (typeof EVENT_ORDER_KINDS)[number][]): EventOrder {
  return ordered.join(',') as EventOrder;
}

function move(index: number, delta: -1 | 1): void {
  const next = kinds.value.slice();
  const target = index + delta;
  if (target < 0 || target >= next.length) return;
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved);
  emit('update:modelValue', toOrder(next));
}
</script>

<template>
  <p class="hint">
    Later items process after earlier ones on the same day. Pocket spending always runs between
    obligations and planned spend.
  </p>
  <ol class="list">
    <li v-for="(kind, index) in kinds" :key="kind" class="row">
      <span class="label">{{ LABELS[kind] }}</span>
      <span class="controls">
        <button
          type="button"
          :disabled="index === 0"
          aria-label="Move earlier"
          @click="move(index, -1)"
        >
          ↑
        </button>
        <button
          type="button"
          :disabled="index === kinds.length - 1"
          aria-label="Move later"
          @click="move(index, 1)"
        >
          ↓
        </button>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.hint {
  margin: 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
}

.label {
  font-weight: 600;
  color: var(--kapa-ink);
}

.controls {
  display: flex;
  gap: var(--kapa-space-1);
}

.controls button {
  padding: var(--kapa-space-1) var(--kapa-space-2);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-sm);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
}

.controls button:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
