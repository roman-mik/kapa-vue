<script setup lang="ts">
import type { SchedulePreviewItem } from '@/lib/horizon/incomeEditor';
import { formatFullDate } from '@/lib/date';

const props = defineProps<{ items: SchedulePreviewItem[] }>();
</script>

<template>
  <ol v-if="props.items.length" class="preview" data-testid="schedule-preview">
    <li v-for="item in props.items" :key="item.date" class="date">
      <span class="date-key">{{ formatFullDate(item.date) }}</span>
      <span v-if="item.shifted" class="shifted">{{ formatFullDate(item.originalDate!) }}</span>
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
  text-decoration: line-through;
}

.label {
  color: var(--kapa-ink-muted);
}
</style>
