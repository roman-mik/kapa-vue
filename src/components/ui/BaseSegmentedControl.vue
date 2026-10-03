<script setup lang="ts">
// A roving-tabindex `radiogroup` — arrow keys move both focus and selection
// between segments, matching native radio-button keyboard behavior instead
// of requiring a second Tab stop per segment.
const props = defineProps<{
  options: { value: string; label: string }[];
}>();

const model = defineModel<string>();

function select(value: string): void {
  model.value = value;
}

function onKeydown(event: KeyboardEvent, index: number): void {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
  event.preventDefault();
  const delta = event.key === 'ArrowRight' ? 1 : -1;
  const next = props.options[(index + delta + props.options.length) % props.options.length];
  if (next) select(next.value);
}
</script>

<template>
  <div class="segmented" role="radiogroup">
    <button
      v-for="(option, index) in options"
      :key="option.value"
      type="button"
      role="radio"
      class="segment"
      :aria-checked="option.value === model"
      :tabindex="option.value === model ? 0 : -1"
      :class="{ active: option.value === model }"
      @click="select(option.value)"
      @keydown="onKeydown($event, index)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented {
  display: flex;
  gap: 2px;
  padding: 4px;
  background: var(--kapa-neutral-200);
  border-radius: var(--kapa-radius-lg);
}

.segment {
  flex: 1;
  min-height: 44px;
  font: inherit;
  font-weight: 600;
  font-size: var(--kapa-text-body-size);
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border: 1px solid transparent;
  border-radius: var(--kapa-radius-md);
  background: transparent;
  color: var(--kapa-ink-muted);
  cursor: pointer;
  transition:
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.segment.active {
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  box-shadow: var(--kapa-shadow-sm);
}

.segment:focus-visible {
  outline: 2px solid var(--kapa-accent);
  outline-offset: 1px;
}
</style>
