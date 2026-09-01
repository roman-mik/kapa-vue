<script setup lang="ts">
import { useRoute } from 'vue-router';
import { computed } from 'vue';
import { useEntrySheet } from '@/composables/useEntrySheet';

// Five tabs per HorizonTabs.dc.html: Today · Timeline · [ + ] · Money ·
// Settings. Money is a single tab that also highlights on the two desktop
// money routes; Accounts is deliberately absent from phone nav (reachable via
// Today's account chips). The centre [ + ] is the circular add button,
// opening the shared entry sheet mounted once in HorizonLayout.vue.
const navTabs = [
  { key: 'today', label: 'Today', to: { name: 'horizon-today' } },
  { key: 'timeline', label: 'Timeline', to: { name: 'horizon-timeline' } },
  { key: 'money', label: 'Money', to: { name: 'horizon-money' } },
  { key: 'settings', label: 'Settings', to: { name: 'horizon-settings' } },
] as const;

// The Money tab is active on any of its three routes (money, money-in,
// money-out); the rest match their exact route only.
const MONEY_ROUTES = new Set(['horizon-money', 'horizon-money-in', 'horizon-money-out']);

const route = useRoute();
const activeTab = computed(() => {
  const name = route.name as string;
  if (MONEY_ROUTES.has(name)) return 'money';
  return navTabs.find((t) => t.to.name === name)?.key ?? null;
});

const entrySheet = useEntrySheet();

// Default side: infer from ?side= on the phone Money route (for symmetry
// with the desktop "Add" buttons' route-fixed default), otherwise 'out'.
function openEntrySheet(): void {
  const side = route.name === 'horizon-money' && route.query.side === 'in' ? 'in' : 'out';
  entrySheet.open(side);
}
</script>

<template>
  <div class="tabbar-shell">
    <nav class="tabbar horizon-tabbar" aria-label="Horizon">
      <router-link
        v-for="tab in navTabs"
        :key="tab.key"
        :to="tab.to"
        class="tab"
        :class="[tab.key, { active: activeTab === tab.key }]"
      >
        <span class="glyph">
          <svg
            v-if="tab.key === 'today'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 11l8-7 8 7" />
            <path d="M5 10v8h12v-8" />
          </svg>
          <svg
            v-else-if="tab.key === 'timeline'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 15l5-6 4 3 6-8" />
          </svg>
          <svg
            v-else-if="tab.key === 'money'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M4 6h14" />
            <path d="M4 11h14" />
            <path d="M4 16h9" />
          </svg>
          <svg
            v-else
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="3" />
            <path d="M11 2v3" />
            <path d="M11 17v3" />
            <path d="M2 11h3" />
            <path d="M17 11h3" />
          </svg>
        </span>
        <span class="label">{{ tab.label }}</span>
      </router-link>
      <button class="tab add" type="button" aria-label="Add money event" @click="openEntrySheet">
        <span class="glyph add-glyph"></span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.horizon-tabbar {
  background: color-mix(in srgb, var(--kapa-surface) 94%, transparent);
  backdrop-filter: blur(8px);
  padding: 8px 12px 34px;
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 48px;
  padding: 6px 0;
  color: var(--kapa-ink-subtle);
  text-decoration: none;
  border: 0;
  background: none;
  font: inherit;
  font-size: 10.5px;
  cursor: pointer;
  transition: color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.tab .glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kapa-ink-subtle);
}

.tab svg {
  width: 22px;
  height: 22px;
}

.tab .label {
  font-weight: 600;
}

.tab.active {
  color: var(--kapa-accent-700);
}

.tab.active .glyph,
.tab.active .label {
  color: var(--kapa-accent-700);
  font-weight: 700;
}

/* The centre [+] — a filled accent circle per HorizonTabs.dc.html. Rendered
 * with a bare glyph until task 11 wires the entry sheet to open on tap. */
.tab.add .add-glyph {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  box-shadow: 0 3px 10px rgba(46, 43, 37, 0.16);
}

.tab.add:hover .add-glyph,
.tab.add:focus-visible .add-glyph {
  background: var(--kapa-accent-600);
}

.tab.add .add-glyph::after {
  content: '+';
  font-size: 26px;
  font-weight: 600;
  line-height: 1;
}
</style>
