// Module-level (not per-component) state, mirroring useEntrySheet.ts: any
// Pocket view can call open() (a fresh Add, or a Duplicate prefill) and have
// the single <PocketEntrySheet> mounted once in App.vue react to it, rather
// than every trigger mounting its own sheet instance.
import { ref } from 'vue';
import type { Currency } from '@roman-mik/kapa-core/pocket';

export interface DuplicatePrefill {
  amountMinor: number;
  currency: Currency;
  categoryId: string | null;
  note: string | null;
}

const isOpen = ref(false);
const prefill = ref<DuplicatePrefill | null>(null);

function open(options?: { prefill?: DuplicatePrefill }): void {
  prefill.value = options?.prefill ?? null;
  isOpen.value = true;
}

function close(): void {
  isOpen.value = false;
  prefill.value = null;
}

export function usePocketEntrySheet() {
  return { isOpen, prefill, open, close };
}
