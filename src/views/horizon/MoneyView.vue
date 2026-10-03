<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import MoneyInView from '@/views/horizon/MoneyInView.vue';
import MoneyOutView from '@/views/horizon/MoneyOutView.vue';
import { useViewport } from '@/composables/useViewport';

// One component serves all three money routes (redesign task 10):
//   /horizon/money       — phone Money tab: an In/Out toggle drives ?side=
//                          (deep-linkable and kept in sync on toggle).
//   /horizon/money-in    — desktop rail "Money in": side fixed to 'in'.
//   /horizon/money-out   — desktop rail "Money out": side fixed to 'out'.
// The route name carries the fixed side; the `money` route takes it from the
// query (defaulting to In). MoneyInView / MoneyOutView are the two side
// panels; this shell only decides which renders and, on the phone route, hosts
// the shared In/Out toggle.
const route = useRoute();
const router = useRouter();
const { isDesktop } = useViewport();

type Side = 'in' | 'out';

const FIXED_SIDE: Record<string, Side> = {
  'horizon-money-in': 'in',
  'horizon-money-out': 'out',
};

const isMoneyRoute = computed(() => route.name === 'horizon-money');

const side = computed<Side>(() => {
  const fixed = FIXED_SIDE[route.name as string];
  if (fixed) return fixed;
  return route.query.side === 'out' ? 'out' : 'in';
});

function select(next: Side): void {
  if (next === side.value) return;
  // On the fixed desktop routes the rail is the navigation; on the phone
  // `money` route we switch sides and keep the query in sync (shareable,
  // survives reload/back).
  if (isMoneyRoute.value) {
    router.replace({ name: 'horizon-money', query: { side: next } });
  }
}
</script>

<template>
  <!-- The In/Out toggle lives on the phone Money route only; desktop uses the
       rail's two entries. The panels own the signed total, kind filter, FX
       note, list, and the desktop right summary column. -->
  <div v-if="isMoneyRoute && !isDesktop" class="side-toggle" role="group" aria-label="Money in/out">
    <button
      type="button"
      class="seg"
      :class="{ active: side === 'in' }"
      :aria-pressed="side === 'in'"
      @click="select('in')"
    >
      In
    </button>
    <button
      type="button"
      class="seg"
      :class="{ active: side === 'out' }"
      :aria-pressed="side === 'out'"
      @click="select('out')"
    >
      Out
    </button>
  </div>

  <MoneyInView v-if="side === 'in'" :is-desktop="isDesktop" />
  <MoneyOutView v-else :is-desktop="isDesktop" />
</template>

<style scoped>
.side-toggle {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  margin: 0 0 var(--kapa-space-4);
  background: var(--kapa-neutral-200);
  border-radius: 999px;
}

.seg {
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kapa-ink-muted);
  background: transparent;
  border: 0;
  border-radius: 999px;
  min-height: 44px;
  cursor: pointer;
  transition:
    color var(--kapa-motion-fast) var(--kapa-motion-ease),
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    box-shadow var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.seg.active {
  color: var(--kapa-ink);
  font-weight: 700;
  background: var(--kapa-surface);
  box-shadow: 0 1px 3px rgba(46, 43, 37, 0.14);
}
</style>
