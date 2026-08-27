<script setup lang="ts">
const tabs = [
  { to: { name: 'home' }, label: 'Home' },
  { to: { name: 'pocket-history' }, label: 'History' },
  { to: { name: 'pocket-categories' }, label: 'Categories' },
  { to: { name: 'settings' }, label: 'Settings' },
] as const;
</script>

<template>
  <div class="shell">
    <router-link :to="{ name: 'pocket-add' }" class="fab" aria-label="Add expense">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      >
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
      </svg>
    </router-link>

    <nav class="tabbar">
      <router-link
        v-for="tab in tabs"
        :key="tab.label"
        :to="tab.to"
        class="tab"
        active-class="active"
      >
        <svg
          v-if="tab.label === 'Home'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M4 11.5 12 4l8 7.5" />
          <path d="M6 10v9h5v-5h2v5h5v-9" />
        </svg>
        <svg
          v-else-if="tab.label === 'History'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="5" y1="7" x2="19" y2="7" />
          <line x1="5" y1="12" x2="19" y2="12" />
          <line x1="5" y1="17" x2="19" y2="17" />
        </svg>
        <svg
          v-else-if="tab.label === 'Categories'"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
        >
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </svg>
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <line x1="6" y1="4" x2="6" y2="20" />
          <circle cx="6" cy="9" r="2" />
          <line x1="12" y1="4" x2="12" y2="20" />
          <circle cx="12" cy="15" r="2" />
          <line x1="18" y1="4" x2="18" y2="20" />
          <circle cx="18" cy="7" r="2" />
        </svg>
        <span>{{ tab.label }}</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
.shell {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
}

.tabbar {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  background: var(--kapa-surface);
  border-top: 1px solid var(--kapa-neutral-400);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--kapa-space-2) 0 var(--kapa-space-1);
  color: var(--kapa-ink-subtle);
  text-decoration: none;
  font-size: var(--kapa-text-caption-size);
  transition: color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.tab svg {
  width: 22px;
  height: 22px;
}

.tab.active {
  color: var(--kapa-accent-700);
}

.fab {
  position: absolute;
  left: 50%;
  bottom: calc(100% - 6px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  box-shadow: var(--kapa-shadow-md);
  text-decoration: none;
  transition: background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.fab:hover {
  background: var(--kapa-accent-600);
}

.fab svg {
  width: 26px;
  height: 26px;
}
</style>
