<script setup lang="ts">
import BottomTabBar from '@/components/layout/BottomTabBar.vue';
import PocketRail from '@/components/pocket/PocketRail.vue';
import { useViewport } from '@/composables/useViewport';

// Mirrors HorizonLayout.vue: useViewport reacts to the lg breakpoint, so
// crossing it live swaps the shell without a reload. Both branches render
// <router-view> — a phone must reach every /pocket route, not just Home.
// Unlike Horizon, the mobile branch reuses BottomTabBar.vue directly rather
// than a Pocket-specific tab bar — its 5 tabs already are Pocket's routes,
// so there's nothing to fork. /settings and the Pocket|Horizon AppSwitcher
// it hosts stay outside this layout on purpose: dropping showHeader here
// only affects this subtree's own 6 routes, not the shared /settings route,
// so the switcher stays reachable via the rail/tab-bar's own Settings item.
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
