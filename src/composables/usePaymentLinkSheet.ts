import { ref, shallowRef } from 'vue';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
const isOpen = ref(false);
const expense = shallowRef<ExpenseView | null>(null);
const paymentId = ref<string | null>(null);
export function usePaymentLinkSheet() {
  return {
    isOpen,
    expense,
    paymentId,
    open(options: { expense?: ExpenseView; paymentId?: string } = {}) {
      expense.value = options.expense ?? null;
      paymentId.value = options.paymentId ?? null;
      isOpen.value = true;
    },
    close() {
      isOpen.value = false;
      expense.value = null;
      paymentId.value = null;
    },
  };
}
