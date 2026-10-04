import { computed } from 'vue';
import { addDays, loadProjectionInput } from '@roman-mik/kapa-core/horizon';
import {
  getPaymentTrackingState,
  listAccounts,
  listAccountObservations,
  listExpenseCoverage,
  listExpenseCutovers,
  completeLinkExpense,
  reviewExpenseCoverage,
  saveAllowanceCoverage,
  reviewCash,
  startPaymentTracking,
} from '@roman-mik/kapa-core/horizon/queries';
import { getExpense, listExpensesInRange } from '@roman-mik/kapa-core/pocket/queries';
import { dateKeyStartUtc, zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { useSpaceQuery } from './useSpaceQuery';
import { useSessionStore } from '@/stores/session';
import { queryCache } from '@/lib/serverState/queryCache';
import { useSpaceStore } from '@/stores/space';
import { supabase } from '@/lib/supabase';

export async function loadPaymentContext(spaceId: string, timezone: string) {
  const now = new Date();
  const today = zonedDateKey(now, timezone);
  const state = await getPaymentTrackingState(supabase, spaceId);
  const [accounts, observations, coverage, cutovers, expenses, loaded] = await Promise.all([
    listAccounts(supabase, spaceId),
    listAccountObservations(supabase, spaceId),
    listExpenseCoverage(supabase, spaceId),
    listExpenseCutovers(supabase, spaceId),
    listExpensesInRange(
      supabase,
      spaceId,
      dateKeyStartUtc(state?.started_on ?? today.slice(0, 7) + '-01', timezone),
      dateKeyStartUtc(addDays(today, 1), timezone)
    ),
    state
      ? loadProjectionInput(supabase, spaceId, {
          now,
          timeZone: timezone,
          range: { from: today, to: addDays(today, 90) },
          lifecycle: true,
        })
      : null,
  ]);
  return {
    allowance: loaded?.allowanceReview?.stored ?? null,
    state: loaded?.allowanceReview?.tracking ?? state,
    accounts,
    observations,
    coverage,
    cutovers,
    expenses,
    occurrences: loaded?.input.lifecycle?.occurrences ?? [],
    today,
  };
}
export type PaymentContext = Awaited<ReturnType<typeof loadPaymentContext>>;
export type LinkDecision = Parameters<typeof completeLinkExpense>[2];
export type CashDecision = Parameters<typeof reviewCash>[2];
export function usePaymentTracking() {
  const space = useSpaceStore();
  const session = useSessionStore();
  const query = useSpaceQuery({
    resource: 'paymentTracking',
    staleTimeMs: 30_000,
    params: () => [space.currentSpace?.timezone],
    load: ({ spaceId, params }) => loadPaymentContext(spaceId, params[0] as string),
  });
  async function refreshSaved(
    invalidate: () => Promise<unknown>,
    origin: string,
    originUser: string | undefined
  ) {
    await invalidate();
    if (space.currentSpaceId !== origin || session.user?.id !== originUser) return;
    if (
      query.error.value ||
      ['paymentTracking', 'accounts', 'pocketExpenses', 'projection', 'paymentHistory'].some(
        (resource) => queryCache.errors([originUser, origin, resource]).length
      )
    )
      throw new Error(
        'Saved, but payment details could not refresh. Retry refresh without saving again.'
      );
  }
  async function expenseForReview(id: string) {
    const origin = space.currentSpaceId;
    const originUser = session.user?.id;
    const expense = await getExpense(supabase, id);
    if (space.currentSpaceId !== origin || session.user?.id !== originUser) return null;
    if (!expense || expense.space_id !== origin)
      throw new Error('This expense is no longer available in this space.');
    return expense;
  }
  async function link(decision: LinkDecision, requestId: string) {
    const id = space.currentSpaceId;
    const originUser = session.user?.id;
    const invalidate = query.invalidate;
    if (!id) throw new Error('Select a space first.');
    await completeLinkExpense(supabase, id, decision, requestId);
    return { refresh: () => refreshSaved(invalidate, id, originUser) };
  }
  async function allocate(
    decision: Omit<LinkDecision, 'occurrenceId' | 'paymentRevision'>,
    requestId: string
  ) {
    const id = space.currentSpaceId;
    const originUser = session.user?.id;
    const invalidate = query.invalidate;
    if (!id) throw new Error('Select a space first.');
    await reviewExpenseCoverage(
      supabase,
      id,
      { ...decision, occurrenceId: null, paymentRevision: null },
      requestId
    );
    return { refresh: () => refreshSaved(invalidate, id, originUser) };
  }
  async function separateAllowance(snapshot: PaymentContext, requestId: string) {
    const id = space.currentSpaceId;
    const originUser = session.user?.id;
    const invalidate = query.invalidate;
    if (!id || !snapshot.state) throw new Error('Check balances first.');
    await saveAllowanceCoverage(supabase, id, {
      revision: snapshot.allowance?.revision ?? 0,
      sourceRevision: snapshot.state.revision,
      cashRevision: snapshot.state.cash_revision,
      policy: { mode: 'separate' },
      window: null,
      requestId,
    });
    return { refresh: () => refreshSaved(invalidate, id, originUser) };
  }
  async function checkBalances(decision: CashDecision) {
    const id = space.currentSpaceId;
    const originUser = session.user?.id;
    const invalidate = query.invalidate;
    if (!id) throw new Error('Select a space first.');
    await reviewCash(supabase, id, decision);
    return {
      refresh: async () => {
        await startPaymentTracking(supabase, id);
        await refreshSaved(invalidate, id, originUser);
      },
    };
  }
  return {
    ...query,
    context: computed(() => query.data.value),
    link,
    checkBalances,
    allocate,
    separateAllowance,
    expenseForReview,
  };
}
