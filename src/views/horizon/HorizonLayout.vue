<script setup lang="ts">
import HorizonRail from '@/components/horizon/HorizonRail.vue';
import HorizonTabBar from '@/components/horizon/HorizonTabBar.vue';
import { useViewport } from '@/composables/useViewport';

// The mobile/desktop split is the point of H1: on a desktop the full rail
// appears; on a narrow viewport the phone bottom tab bar drives navigation.
// useViewport reacts to the lg breakpoint, so crossing it live swaps the
// shell without a reload. Both branches render <router-view> — a phone must
// reach every /horizon route, not just Today (the pre-redesign bug dropped
// it in the mobile branch).
const { isDesktop } = useViewport();
</script>

<template>
  <template v-if="isDesktop">
    <div class="shell">
      <HorizonRail />
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
      <HorizonTabBar />
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
