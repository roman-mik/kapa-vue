<script setup lang="ts">
import AppHeader from '@/components/layout/AppHeader.vue';
import BottomTabBar from '@/components/layout/BottomTabBar.vue';
import PocketRail from '@/components/pocket/PocketRail.vue';
import { useViewport } from '@/composables/useViewport';

// Mirrors HorizonLayout.vue: useViewport reacts to the lg breakpoint, so
// crossing it live swaps the shell without a reload. Both branches render
// <router-view> — a phone must reach every /pocket route, not just Home.
// Both apps expose the same app navigation in their mobile header.
// Shared Settings retains its standalone header via route metadata.
const { isDesktop } = useViewport();
</script>

<template>
  <template v-if="isDesktop">
    <div class="shell">
      <PocketRail />
      <main class="content">
        <router-view />
      </main>
    </div>
  </template>
  <template v-else>
    <div class="phone-shell">
      <AppHeader />
      <main class="content">
        <router-view />
      </main>
      <BottomTabBar />
    </div>
  </template>
</template>

<style scoped>
.shell {
  display: flex;
  min-height: 100dvh;
}

.phone-shell {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.content {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--kapa-space-6) var(--kapa-space-4);
}
</style>
