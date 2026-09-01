<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  modelValue: number[];
}>();

const emit = defineEmits<{ 'update:modelValue': [value: number[]] }>();

// 0 = Sunday … 6 = Saturday, matching horizon.work_calendars.working_weekdays.
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

const selected = computed(() => new Set(props.modelValue));

function setDay(value: number, on: boolean): void {
  const next = new Set(selected.value);
  if (on) next.add(value);
  else next.delete(value);
  emit('update:modelValue', [...next].sort());
}
</script>

<template>
  <p class="hint">
    Working days determine hourly income and payment slippage. Hours worked on non-working days are
    not counted.
  </p>
  <div class="days">
    <label v-for="day in DAYS" :key="day.value" class="day-label">
      <input
        type="checkbox"
        :checked="selected.has(day.value)"
        @change="setDay(day.value, ($event.target as HTMLInputElement).checked)"
      />
      <span>{{ day.label }}</span>
    </label>
  </div>
</template>

<style scoped>
.hint {
  margin: 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--kapa-space-2);
}

.day-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--kapa-space-1);
  min-height: 44px;
  padding: var(--kapa-space-2);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.day-label:has(input:checked) {
  background: var(--kapa-accent-100);
  color: var(--kapa-accent-700);
  border-color: var(--kapa-accent-100);
}

.day-label:has(input:focus-visible) {
  outline: 2px solid var(--kapa-accent);
  outline-offset: 2px;
}

.day-label input {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

@media (min-width: 480px) {
  .day-label {
    flex-direction: row;
  }
}
</style>
