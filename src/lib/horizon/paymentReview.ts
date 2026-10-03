import type { NegativeDayWarning } from '@roman-mik/kapa-core/horizon';

export interface PaymentReviewTarget {
  kind: string;
  id: string;
  date: string;
}

export function paymentReviewRoute(warning: NegativeDayWarning) {
  if (warning.fix.kind !== 'shiftPayment') return { name: 'horizon-money', query: { side: 'out' } };
  const event = warning.fix.event;
  return {
    name: 'horizon-money',
    query: {
      side: event.kind === 'income' || event.kind === 'oneOffIn' ? 'in' : 'out',
      reviewKind: event.kind,
      reviewId: event.sourceId,
      reviewDate: event.date,
    },
  };
}
