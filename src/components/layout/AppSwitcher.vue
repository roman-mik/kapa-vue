<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

// A route is "inside Horizon" when it's any child of the /horizon parent —
// the parent itself and every sub-view. Pocket is the default everything
// else (its own routes plus /settings, /spaces).
const isHorizon = computed(() => route.path.startsWith('/horizon'));
const isPocket = computed(() => !isHorizon.value);
</script>

<template>
  <div class="switcher" role="tablist" aria-label="App">
    <router-link
      :to="{ name: 'home' }"
      role="tab"
      :aria-selected="isPocket"
      :class="['tab', { active: isPocket }]"
    >
      Pocket
    </router-link>
    <router-link
      :to="{ name: 'horizon-today' }"
      role="tab"
      :aria-selected="isHorizon"
      :class="['tab', { active: isHorizon }]"
    >
      Horizon
    </router-link>
  </div>
</template>

<style scoped>
.switcher {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  background: var(--kapa-surface);
}

.tab {
  padding: var(--kapa-space-1) var(--kapa-space-3);
  border-radius: calc(var(--kapa-radius-md) - 2px);
  color: var(--kapa-ink-subtle);
  text-decoration: none;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  transition:
    color var(--kapa-motion-fast) var(--kapa-motion-ease),
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.tab.active {
  background: var(--kapa-accent);
  color: var(--kapa-white);
}
</style>
