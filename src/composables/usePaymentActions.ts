import { computed } from 'vue';
import type { OccurrenceAction, TrackedOccurrence } from '@roman-mik/kapa-core/horizon';
import {
  applyPaymentAction,
  undoPaymentAction,
  listPaymentActions,
} from '@roman-mik/kapa-core/horizon/queries';
import { useSpaceQuery } from './useSpaceQuery';
import { usePaymentTracking } from './usePaymentTracking';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { supabase } from '@/lib/supabase';
import { invalidateResources } from '@/lib/serverState/invalidation';
import { queryCache } from '@/lib/serverState/queryCache';

export function usePaymentActions(getPaymentId: () => string | null) {
  const space = useSpaceStore();
  const session = useSessionStore();
  const tracking = usePaymentTracking();
  const history = useSpaceQuery({
    resource: 'paymentHistory',
    staleTimeMs: 30_000,
    params: () => [getPaymentId()],
    load: ({ spaceId, params }) =>
      params[0] ? listPaymentActions(supabase, spaceId, params[0] as string) : Promise.resolve([]),
  });
  const records = computed(() =>
    [...(history.data.value ?? [])].sort(
      (a, b) =>
        Number((b.after_value as { revision?: number }).revision ?? 0) -
        Number((a.after_value as { revision?: number }).revision ?? 0)
    )
  );
  const latest = computed(() => records.value[0] ?? null);
  function capture(payment: TrackedOccurrence) {
    const userId = session.user?.id;
    const spaceId = space.currentSpaceId;
    if (!spaceId || !userId) throw new Error('Select an authenticated space first.');
    if (!tracking.context.value?.occurrences.some((p) => p.id === payment.id))
      throw new Error('This payment is not available in this space. Reload before saving.');
    if (tracking.context.value.coverage.some((c) => c.occurrenceId === payment.id))
      throw new Error('Review the linked Pocket expense before changing this payment.');
    const last = latest.value;
    if (
      (last?.command as { kind?: string } | undefined)?.kind === 'sourceRetire' &&
      (last?.after_value as { revision?: number } | undefined)?.revision === payment.revision
    )
      throw new Error(
        'This payment was retired by a schedule change. Review its recurring source instead.'
      );
    return { userId, spaceId };
  }
  function savedRefresh(userId: string, spaceId: string) {
    return async () => {
      await invalidateResources(userId, spaceId, 'paymentTracking');
      if (
        ['paymentTracking', 'paymentHistory', 'accounts', 'projection', 'pocketExpenses'].some(
          (resource) => queryCache.errors([userId, spaceId, resource]).length
        )
      )
        throw new Error(
          'Saved, but payment details could not refresh. Retry refresh without saving again.'
        );
    };
  }
  async function apply(payment: TrackedOccurrence, action: OccurrenceAction, requestId: string) {
    const { userId, spaceId } = capture(payment);
    const result = await applyPaymentAction(
      supabase,
      spaceId,
      payment.id,
      payment.revision,
      requestId,
      action
    );
    return { payment: result, refresh: savedRefresh(userId, spaceId) };
  }
  async function undo(payment: TrackedOccurrence, actionId: string, requestId: string) {
    const { userId, spaceId } = capture(payment);
    const last = latest.value;
    const after = last?.after_value as { revision?: number } | undefined;
    if (
      !last ||
      last.id !== actionId ||
      last.occurrence_id !== payment.id ||
      after?.revision !== payment.revision
    )
      throw new Error('Payment changed. Reload and review the latest action before undoing.');
    const result = await undoPaymentAction(
      supabase,
      spaceId,
      payment.id,
      payment.revision,
      requestId,
      actionId
    );
    return { payment: result, refresh: savedRefresh(userId, spaceId) };
  }
  return { tracking, history, records, latest, apply, undo };
}
