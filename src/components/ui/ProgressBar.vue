<script setup lang="ts">
// `percent` must already be a 0..100 value — kapa-core's spentPct() clamps
// it; this component only renders, it doesn't derive.
withDefaults(
  defineProps<{
    percent: number;
    state?: 'healthy' | 'nudge' | 'over';
  }>(),
  { state: 'healthy' }
);
</script>

<template>
  <div
    class="bar"
    role="progressbar"
    :aria-valuenow="Math.round(percent)"
    aria-valuemin="0"
    aria-valuemax="100"
  >
    <div class="fill" :class="`state-${state}`" :style="{ width: `${percent}%` }" />
  </div>
</template>

<style scoped>
.bar {
  height: 10px;
  border-radius: 999px;
  background: var(--kapa-neutral-300);
  overflow: hidden;
}

.fill {
  height: 100%;
  background: var(--kapa-accent);
  transition: width var(--kapa-motion-base) var(--kapa-motion-ease);
}

.fill.state-nudge {
  background: var(--kapa-accent-700);
}

.fill.state-over {
  background: var(--kapa-negative);
}
</style>
