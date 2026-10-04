import { ref } from 'vue';
const paymentId = ref<string | null>(null);
export function usePaymentActionSheet() {
  return {
    paymentId,
    open(id: string) {
      paymentId.value = id;
    },
    close() {
      paymentId.value = null;
    },
  };
}
