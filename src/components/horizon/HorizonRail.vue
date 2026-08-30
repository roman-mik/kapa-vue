<script setup lang="ts">
import AppSwitcher from '@/components/layout/AppSwitcher.vue';

const links = [
  { name: 'horizon-today', label: 'Today' },
  { name: 'horizon-accounts', label: 'Accounts' },
  { name: 'horizon-timeline', label: 'Timeline' },
  { name: 'horizon-money-in', label: 'Money in' },
  { name: 'horizon-money-out', label: 'Money out' },
  { name: 'horizon-settings', label: 'Settings' },
] as const;
</script>

<template>
  <nav class="rail" aria-label="Horizon">
    <div class="brand">
      <span class="title">Horizon</span>
      <AppSwitcher />
    </div>

    <div class="links">
      <router-link
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        class="link"
        active-class="active"
        exact-active-class="active"
      >
        {{ link.label }}
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
  width: 100%;
  max-width: 16rem;
  border-right: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  padding: var(--kapa-space-4);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.title {
  font-family: var(--font-heading);
  font-size: var(--kapa-text-title-size);
  color: var(--kapa-ink);
}

.links {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.link {
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border-radius: var(--kapa-radius-md);
  color: var(--kapa-ink-muted);
  text-decoration: none;
  font-weight: 600;
  transition:
    color var(--kapa-motion-fast) var(--kapa-motion-ease),
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.link:hover {
  color: var(--kapa-ink);
}

.link.active {
  background: var(--kapa-accent-100);
  color: var(--kapa-accent-700);
}
</style>
