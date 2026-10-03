import { ref } from 'vue';
import { applyNightMode, readNightMode, storeNightMode } from '@/lib/nightMode';

// Module-level (not per-component) state, mirroring usePocketEntrySheet.ts —
// any component reading useNightMode() sees the same toggle state.
const enabled = ref(readNightMode());

function toggle(next: boolean): void {
  enabled.value = next;
  storeNightMode(next);
  applyNightMode(next);
}

export function useNightMode() {
  return { enabled, toggle };
}
