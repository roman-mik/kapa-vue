import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CashflowTrial } from '@/lib/horizon/purchaseTrial';
export const useCashflowTrialStore = defineStore('cashflowTrial', () => {
  const draft = ref<CashflowTrial | null>(null);
  const scope = ref('');
  function reset() {
    draft.value = null;
  }
  function bind(next: string) {
    if (scope.value !== next) {
      reset();
      scope.value = next;
    }
  }
  return { draft, scope, reset, bind };
});
