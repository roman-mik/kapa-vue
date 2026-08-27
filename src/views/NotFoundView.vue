<script setup lang="ts">
import BaseButton from '@/components/ui/BaseButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
</script>

<template>
  <main class="page">
    <EmptyState title="Page not found" message="That link doesn't lead anywhere in Pocket.">
      <router-link to="/">
        <BaseButton>Back to home</BaseButton>
      </router-link>
    </EmptyState>
  </main>
</template>
