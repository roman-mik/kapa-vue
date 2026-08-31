<script setup lang="ts">
import type { GlyphShape } from '@/lib/eventGlyphs';

withDefaults(
  defineProps<{
    shape: GlyphShape;
    x: number;
    y: number;
    size?: number;
  }>(),
  { size: 5 }
);
</script>

<template>
  <circle v-if="shape === 'circle'" :cx="x" :cy="y" :r="size" />
  <rect
    v-else-if="shape === 'square'"
    :x="x - size"
    :y="y - size"
    :width="size * 2"
    :height="size * 2"
  />
  <polygon
    v-else-if="shape === 'diamond'"
    :points="`${x},${y - size} ${x + size},${y} ${x},${y + size} ${x - size},${y}`"
  />
  <polygon
    v-else-if="shape === 'triangle-down'"
    :points="`${x - size},${y - size} ${x + size},${y - size} ${x},${y + size}`"
  />
  <polygon
    v-else-if="shape === 'triangle-up'"
    :points="`${x - size},${y + size} ${x + size},${y + size} ${x},${y - size}`"
  />
  <circle v-else :cx="x" :cy="y" :r="size" fill="none" stroke="currentColor" stroke-width="2" />
</template>
