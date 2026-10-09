import { ref } from 'vue';
const paymentId = ref<string | null>(null);
const dateTrial = ref<{ date: string; fingerprint: string } | null>(null);
export function usePaymentActionSheet() {
  return {
    paymentId,
    dateTrial,
    open(id: string, trial?: { date: string; fingerprint: string }) {
      dateTrial.value = trial ?? null;
      paymentId.value = id;
    },
    close() {
      paymentId.value = null;
      dateTrial.value = null;
    },
  };
}
