<script setup lang="ts">
import { useRoute } from 'vue-router';
import AppHeader from '@/components/layout/AppHeader.vue';
import BottomTabBar from '@/components/layout/BottomTabBar.vue';
import ToastHost from '@/components/ui/ToastHost.vue';

const route = useRoute();
</script>

<template>
  <AppHeader v-if="route.meta.showHeader" />
  <router-view />
  <ToastHost />
  <BottomTabBar v-if="route.meta.showHeader" />
</template>
