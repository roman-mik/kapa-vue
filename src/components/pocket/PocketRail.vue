<script setup lang="ts">
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import { usePocketEntrySheet } from '@/composables/usePocketEntrySheet';
import { usePocketHome } from '@/composables/usePocketHome';
import { useSpaceMembers } from '@/composables/useSpaceMembers';
import { formatMoney } from '@/lib/money';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';

// 4 desktop routes per PocketRail.dc.html — Settings routes to the
// top-level (not Pocket-nested) /settings, which is how the Pocket|Horizon
// AppSwitcher stays reachable once this layout owns its own chrome (see
// PocketLayout.vue's comment).
const links = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'pocket-history', label: 'History', icon: 'history' },
  { name: 'pocket-categories', label: 'Categories', icon: 'categories' },
  { name: 'settings', label: 'Settings', icon: 'settings' },
] as const;

const space = useSpaceStore();
const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);
const spaceName = computed(() => space.currentSpace?.name ?? '');

const entrySheet = usePocketEntrySheet();

// Cap-progress footer card. No dedicated cap field exists on PocketSummary —
// `spent + remaining` recovers it, the same recovery CapProgressCard.vue
// uses. This is a compact sibling of that card (rail-specific chrome), not
// a shared component — it doesn't need the full narrative/pace-marker copy.
const { summary } = usePocketHome();
const capMinor = computed(() =>
  summary.value ? summary.value.spent + summary.value.remaining : 0
);
const fillPct = computed(() => (summary.value ? Math.min(summary.value.spentPct, 100) : 0));

// "2026-09" -> "September" — never show a bare ISO-ish month string,
// mirroring AppHeader.vue's monthLabel formula.
const monthLabel = computed(() => {
  if (!summary.value) return '';
  const [year, monthIndex] = summary.value.month.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, { month: 'long' }).format(
    new Date(year, monthIndex - 1, 1)
  );
});

// Member chip: current member's initials (first letter of up to two words
// in their display name, derived locally — one-off, decorative, no new
// shared helper) plus the space's total member count.
const { members } = useSpaceMembers();
const session = useSessionStore();
const currentMember = computed(() => members.value.find((m) => m.userId === session.user?.id));
const initials = computed(() => {
  const name = currentMember.value?.displayName;
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
});
</script>

<template>
  <nav class="rail" aria-label="Pocket">
    <div class="brand">
      <span class="title">Pocket</span>
      <span class="subtitle"> {{ spaceName }} · {{ spaceCurrency }} household </span>
    </div>

    <button type="button" class="add-btn" @click="entrySheet.open()">
      <span class="add-icon">+</span>Add expense
    </button>

    <div class="links">
      <router-link
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        class="link"
        active-class="active"
        exact-active-class="active"
      >
        <span class="link-icon">
          <svg
            v-if="link.icon === 'home'"
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
            v-else-if="link.icon === 'history'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 5v6l4 2" />
            <path d="M11 3a8 8 0 108 8" />
          </svg>
          <svg
            v-else-if="link.icon === 'categories'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="4" y="4" width="6" height="6" />
            <rect x="12" y="4" width="6" height="6" />
            <rect x="4" y="12" width="6" height="6" />
            <rect x="12" y="12" width="6" height="6" />
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
        <span>{{ link.label }}</span>
      </router-link>
    </div>

    <div v-if="summary" class="cap-card">
      <span class="cap-heading">{{ monthLabel }}</span>
      <div class="cap-figure">
        <span class="cap-remaining money-amount">{{
          formatMoney(summary.remaining, summary.currency)
        }}</span>
        <span class="cap-of">left of {{ formatMoney(capMinor, summary.currency) }}</span>
      </div>
      <div class="cap-track">
        <div class="cap-fill" :style="{ width: `${fillPct}%` }" />
      </div>
    </div>

    <div v-if="currentMember" class="member">
      <span class="avatar">{{ initials }}</span>
      <span class="member-info">
        <span class="member-name">{{ currentMember.displayName }}</span>
        <span class="member-count">{{ members.length }} members</span>
      </span>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
  width: 224px;
  flex: none;
  box-sizing: border-box;
  border-right: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  padding: var(--kapa-space-5) var(--kapa-space-4) var(--kapa-space-4);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 var(--kapa-space-2);
}

.title {
  font-family: var(--font-heading);
  font-size: 23px;
  line-height: 1.1;
  color: var(--kapa-ink);
}

.subtitle {
  font-size: 11.5px;
  color: var(--kapa-ink-muted);
}

.add-btn {
  border: 0;
  cursor: pointer;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  border-radius: 999px;
  padding: var(--kapa-space-3) var(--kapa-space-4);
  font: inherit;
  font-size: 14.5px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--kapa-space-2);
  box-shadow: var(--kapa-shadow-md);
  transition: background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.add-btn:hover {
  background: var(--kapa-accent-600);
}

.add-icon {
  font-size: 19px;
  line-height: 1;
}

.links {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-decoration: none;
  transition:
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.link-icon {
  width: 18px;
  height: 18px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.link svg {
  width: 18px;
  height: 18px;
}

.link.active {
  background: var(--kapa-accent);
  color: var(--kapa-white);
  font-weight: 700;
}

.cap-card {
  margin-top: auto;
  padding: var(--kapa-space-3);
  background: var(--kapa-neutral-100);
  border: 1px solid var(--kapa-neutral-300);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.cap-heading {
  font-size: 10.5px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--kapa-ink-muted);
}

.cap-figure {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cap-remaining {
  font-size: 22px;
  line-height: 1;
}

.cap-of {
  font-size: 12px;
  color: var(--kapa-ink-muted);
}

.cap-track {
  height: 8px;
  border-radius: 999px;
  background: var(--kapa-neutral-300);
  overflow: hidden;
}

.cap-fill {
  height: 100%;
  background: var(--kapa-accent);
  transition: width var(--kapa-motion-base) var(--kapa-motion-ease);
}

.member {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
  padding: 0 var(--kapa-space-1);
}

.avatar {
  width: 32px;
  height: 32px;
  flex: none;
  border-radius: 999px;
  background: var(--kapa-positive-200);
  color: var(--kapa-positive-700);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.member-info {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.member-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--kapa-ink);
}

.member-count {
  font-size: 11.5px;
  color: var(--kapa-ink-muted);
}
</style>
