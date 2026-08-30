<script setup lang="ts">
import HorizonRail from '@/components/horizon/HorizonRail.vue';
import TodayView from '@/views/horizon/TodayView.vue';
import { useViewport } from '@/composables/useViewport';

// The mobile/desktop split is the point of H1: on a narrow viewport the
// only reachable Horizon screen is Today; on desktop the full rail appears.
// useViewport reacts to the lg breakpoint, so crossing it live swaps the
// shell without a reload.
const { isDesktop } = useViewport();
</script>

<template>
  <div v-if="isDesktop" class="shell">
    <HorizonRail />
    <main class="content">
      <router-view />
    </main>
  </div>
  <TodayView v-else />
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100dvh;
}

.content {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--kapa-space-6) var(--kapa-space-4);
}
</style>
