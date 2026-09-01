<script setup lang="ts">
// The proportional-share-of-cap bar — extracted from PocketHomeView's
// "By category" widget so CategoriesView can reuse the identical track/fill
// recipe with a per-category colour instead of the single accent fill Home
// uses (callers that want Home's original look simply omit `color`).
withDefaults(defineProps<{ percent: number; color?: string }>(), {
  color: 'var(--kapa-accent)',
});
</script>

<template>
  <div class="share-bar" role="presentation">
    <div class="share-bar-fill" :style="{ width: `${percent}%`, background: color }" />
  </div>
</template>

<style scoped>
.share-bar {
  height: 6px;
  border-radius: 999px;
  background: var(--kapa-neutral-300);
  overflow: hidden;
}

.share-bar-fill {
  height: 100%;
  border-radius: inherit;
}
</style>
