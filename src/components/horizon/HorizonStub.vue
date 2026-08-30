<script setup lang="ts">
import EmptyState from '@/components/ui/EmptyState.vue';

defineProps<{
  title: string;
  message: string;
}>();
</script>

<template>
  <main class="page">
    <EmptyState :title="title" :message="message" />
  </main>
</template>
