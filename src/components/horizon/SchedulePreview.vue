<script setup lang="ts">
import type { SchedulePreviewItem } from '@/lib/horizon/incomeEditor';

const props = defineProps<{ items: SchedulePreviewItem[] }>();

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

function prettyDate(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${MONTH_LABELS[Number(month) - 1]} ${Number(day)}`;
}
</script>

<template>
  <ol v-if="props.items.length" class="preview" data-testid="schedule-preview">
    <li v-for="item in props.items" :key="item.date" class="date">
      <span class="date-key">{{ prettyDate(item.date) }}</span>
      <span v-if="item.shifted" class="shifted">was {{ prettyDate(item.originalDate!) }}</span>
      <span v-if="item.label" class="label">{{ item.label }}</span>
    </li>
  </ol>
</template>

<style scoped>
.preview {
  list-style: none;
  margin: 0;
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: var(--kapa-neutral-200);
  border-radius: var(--kapa-radius-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
}

.date {
  display: inline-flex;
  align-items: baseline;
  gap: var(--kapa-space-1);
  font-size: var(--kapa-text-caption-size);
}

.date-key {
  font-weight: 600;
  color: var(--kapa-ink);
}

.shifted {
  color: var(--kapa-ink-muted);
}

.label {
  color: var(--kapa-ink-muted);
}
</style>
