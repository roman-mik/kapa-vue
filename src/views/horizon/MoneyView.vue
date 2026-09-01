<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import EmptyState from '@/components/ui/EmptyState.vue';

// Navigation target for the phone Money tab (redesign task 6). This is a
// minimal stub only — it resolves on all three money routes so the tab bar
// can navigate and highlight. The real merged one-list Money view (in/out
// toggle, kind filter, cards) is task 10, which serves /horizon/money,
// /horizon/money-in and /horizon/money-out from one component and drives the
// active side via ?side=.
const route = useRoute();

// /horizon/money?side=out selects the Out side; absent or unrecognised
// falls back to In. The stub merely reflects it — the toggle that keeps the
// query in sync arrives with task 10.
const side = computed(() => (route.query.side === 'out' ? 'out' : 'in'));
</script>

<template>
  <main class="page">
    <EmptyState
      :title="`Money — ${side}`"
      message="The merged money list lands with the redesign (task 10)."
    />
  </main>
</template>
