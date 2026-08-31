<script setup lang="ts">
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue';
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
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
}

.day-label {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-1);
  font-size: var(--kapa-text-body-size);
  color: var(--kapa-ink);
  cursor: pointer;
}

.day-label input {
  accent-color: var(--kapa-accent);
  width: 1.1em;
  height: 1.1em;
}
</style>
