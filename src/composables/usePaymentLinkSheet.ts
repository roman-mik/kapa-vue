import { ref, shallowRef } from 'vue';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
const isOpen = ref(false);
const expense = shallowRef<ExpenseView | null>(null);
const balanceReview = ref(false);
const paymentId = ref<string | null>(null);
export function usePaymentLinkSheet() {
  return {
    isOpen,
    expense,
    paymentId,
    balanceReview,
    open(options: { expense?: ExpenseView; paymentId?: string; balanceReview?: boolean } = {}) {
      balanceReview.value = options.balanceReview ?? false;
      expense.value = options.expense ?? null;
      paymentId.value = options.paymentId ?? null;
      isOpen.value = true;
    },
    close() {
      isOpen.value = false;
      balanceReview.value = false;
      expense.value = null;
      paymentId.value = null;
    },
  };
}
