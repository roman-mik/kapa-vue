import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { CautiousScenario } from '@roman-mik/kapa-core/horizon';
export const useCautiousScenarioStore = defineStore('cautiousScenario', () => {
  const mode = ref<'expected' | 'cautious'>('expected');
  const draft = ref<CautiousScenario>({ changes: [], dailySpend: null });
  const scope = ref('');
  function reset() {
    mode.value = 'expected';
    draft.value = { changes: [], dailySpend: null };
  }
  function bind(next: string) {
    if (scope.value !== next) {
      reset();
      scope.value = next;
    }
  }
  return { mode, draft, scope, reset, bind };
});
