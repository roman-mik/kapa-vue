<script setup lang="ts">
withDefaults(
  defineProps<{
    height?: string;
    width?: string;
    radius?: 'sm' | 'md' | 'lg';
  }>(),
  { height: '1em', width: '100%', radius: 'sm' }
);
</script>

<template>
  <div class="skeleton" :class="`radius-${radius}`" :style="{ height, width }" aria-hidden="true" />
</template>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--kapa-neutral-200) 25%,
    var(--kapa-neutral-300) 37%,
    var(--kapa-neutral-200) 63%
  );
  background-size: 400% 100%;
  animation: shimmer 1.4s ease infinite;
}

.radius-sm {
  border-radius: var(--kapa-radius-sm);
}

.radius-md {
  border-radius: var(--kapa-radius-md);
}

.radius-lg {
  border-radius: var(--kapa-radius-lg);
}

@keyframes shimmer {
  0% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0 50%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
  }
}
</style>
