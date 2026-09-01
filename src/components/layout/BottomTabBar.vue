<script setup lang="ts">
const tabs = [
  { to: { name: 'home' }, label: 'Home' },
  { to: { name: 'pocket-history' }, label: 'History' },
  { to: { name: 'pocket-add' }, label: 'Add' },
  { to: { name: 'pocket-categories' }, label: 'Categories' },
  { to: { name: 'settings' }, label: 'Settings' },
] as const;
</script>

<template>
  <div class="tabbar-shell">
    <nav class="tabbar">
      <router-link
        v-for="tab in tabs"
        :key="tab.label"
        :to="tab.to"
        class="tab"
        :class="{ add: tab.label === 'Add' }"
        active-class="active"
        :aria-label="tab.label === 'Add' ? 'Add expense' : undefined"
      >
        <span class="glyph">
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
            v-else-if="tab.label === 'Add'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
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
        </span>
        <span v-if="tab.label !== 'Add'">{{ tab.label }}</span>
        <span v-else class="sr-only">Add</span>
      </router-link>
    </nav>
  </div>
</template>

<style scoped>
/* The sticky shell and the 5-column grid (`.tabbar-shell` / `.tabbar`) live
 * in main.css, shared with HorizonTabBar. What's local here is the button
 * anatomy: glyph + label stacking, the circular Add, and the active tint. */
.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: var(--kapa-space-2) 0 var(--kapa-space-1);
  color: var(--kapa-ink-subtle);
  text-decoration: none;
  font-size: var(--kapa-text-caption-size);
  transition: color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.tab .glyph {
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab svg {
  width: 22px;
  height: 22px;
}

.tab.active {
  color: var(--kapa-accent-700);
}

/* The add tab's glyph is a filled circle rather than a bare icon, sized
 * from the shared kapa-core layout token so it never overhangs the bar
 * (that overhang is what let it drift onto page content before). */
.tab.add .glyph {
  width: var(--kapa-layout-add-button-size);
  height: var(--kapa-layout-add-button-size);
  border-radius: 50%;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  box-shadow: var(--kapa-shadow-sm);
  transition: background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.tab.add:hover .glyph,
.tab.add.active .glyph {
  background: var(--kapa-accent-600);
}

.tab.add.active {
  color: var(--kapa-ink-subtle);
}

.tab.add svg {
  width: 24px;
  height: 24px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
