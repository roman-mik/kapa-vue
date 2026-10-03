import { currentMonth, monthWindow } from '@roman-mik/kapa-core/pocket';
import type {
  ExpenseUpdate,
  ExpenseView,
  MutationOutcome,
} from '@roman-mik/kapa-core/pocket/queries';
import {
  addExpense,
  deleteExpense,
  getExpense,
  listExpensesInRange,
  updateExpense,
} from '@roman-mik/kapa-core/pocket/queries';
import { computed } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';

export interface NewExpense {
  amountMinor: number;
  currency: string;
  categoryId: string | null;
  note: string | null;
  spentAt?: string;
}

// The current-month expense list for the current space — no arithmetic,
// this is CRUD only via kapa-core's query layer. usePocketHome fetches its
// own month-scoped slice for deriving figures; this composable is for the
// history screen's list, scoped the same way rather than pulling the
// space's entire unpaginated history.
export function useExpenses() {
  const space = useSpaceStore();
  const session = useSessionStore();
  const month = computed(() =>
    space.currentSpace ? currentMonth(new Date(), space.currentSpace.timezone) : null
  );
  const query = useSpaceQuery<ExpenseView[]>({
    resource: 'pocketExpenses',
    staleTimeMs: 30_000,
    params: () => [month.value, space.currentSpace?.timezone],
    load: ({ spaceId, params }) => {
      const [month, timezone] = params as [string, string];
      const { startUtc, endUtc } = monthWindow(month, timezone);
      return listExpensesInRange(supabase, spaceId, startUtc, endUtc);
    },
  });
  const expenses = computed(() => query.data.value ?? []);

  async function add(expense: NewExpense): Promise<void> {
    const invalidate = query.invalidate;
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await addExpense(supabase, {
      space_id: spaceId,
      user_id: session.user?.id ?? null,
      amount_minor: expense.amountMinor,
      currency: expense.currency,
      category_id: expense.categoryId,
      note: expense.note,
      ...(expense.spentAt ? { spent_at: expense.spentAt } : {}),
    });
    await invalidate();
  }

  // `expectedUpdatedAt` is the row's `updated_at` as this client last read
  // it — kapa-core scopes the write to it and reports a conflict instead of
  // clobbering another member's change. Conflicts don't throw: the list is
  // refreshed either way and the outcome is returned for the view to surface.
  async function update(
    expenseId: string,
    patch: ExpenseUpdate,
    expectedUpdatedAt: string
  ): Promise<MutationOutcome> {
    const invalidate = query.invalidate;
    const outcome = await updateExpense(supabase, expenseId, patch, expectedUpdatedAt);
    await invalidate();
    return outcome;
  }

  async function remove(expenseId: string, expectedUpdatedAt: string): Promise<MutationOutcome> {
    const invalidate = query.invalidate;
    const outcome = await deleteExpense(supabase, expenseId, expectedUpdatedAt);
    await invalidate();
    return outcome;
  }

  async function getById(expenseId: string): Promise<ExpenseView | null> {
    const cached = expenses.value.find((expense) => expense.id === expenseId);
    return cached ?? getExpense(supabase, expenseId);
  }

  return {
    expenses,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    add,
    update,
    remove,
    getById,
  };
}
