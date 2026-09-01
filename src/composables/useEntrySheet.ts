// Module-level (not per-component) state, mirroring useToast.ts: any view can
// call open() and have the single <EntrySheet> mounted once in
// HorizonLayout.vue react to it, rather than every trigger mounting its own
// sheet instance.
import { ref } from 'vue';

const isOpen = ref(false);
const defaultSide = ref<'in' | 'out'>('out');

function open(side: 'in' | 'out' = 'out'): void {
  defaultSide.value = side;
  isOpen.value = true;
}

function close(): void {
  isOpen.value = false;
}

export function useEntrySheet() {
  return { isOpen, defaultSide, open, close };
}
