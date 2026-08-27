<script setup lang="ts">
import { currentMonth } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import { useSpaceStore } from '@/stores/space';

const space = useSpaceStore();

// currentMonth() is kapa-core's — it's the same timezone-correct month the
// home screen's math uses. Only the "August 2026" rendering is presentation.
const monthLabel = computed(() => {
  const timeZone = space.currentSpace?.timezone;
  if (!timeZone) return '';
  const month = currentMonth(new Date(), timeZone);
  const [year, monthIndex] = month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
    new Date(year, monthIndex - 1, 1)
  );
});
</script>

<template>
  <header class="app-header">
    <span class="space">{{ space.currentSpace?.name }}</span>
    <span class="month">{{ monthLabel }}</span>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  padding: calc(var(--kapa-space-3) + env(safe-area-inset-top, 0px)) var(--kapa-space-4)
    var(--kapa-space-3);
  border-bottom: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
}

.space {
  font-weight: 600;
  color: var(--kapa-ink);
}

.month {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}
</style>
