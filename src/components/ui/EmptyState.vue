<script setup lang="ts">
defineProps<{
  title: string;
  message?: string;
}>();
</script>

<template>
  <div class="empty">
    <p class="title">{{ title }}</p>
    <p v-if="message" class="message">{{ message }}</p>
    <div v-if="$slots.default" class="action">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--kapa-space-2);
  padding: var(--kapa-space-6) var(--kapa-space-4);
  color: var(--kapa-ink-muted);
}

.title {
  margin: 0;
  font-weight: 600;
  color: var(--kapa-ink);
}

.message {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
}

.action {
  margin-top: var(--kapa-space-2);
}
</style>
