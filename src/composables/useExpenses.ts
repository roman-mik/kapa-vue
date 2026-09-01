import { currentMonth, monthWindow } from '@roman-mik/kapa-core/pocket';
import type {
  ExpenseUpdate,
  ExpenseView,
  MutationOutcome,
} from '@roman-mik/kapa-core/pocket/queries';
import {
  addExpense,
  deleteExpense,
  listExpensesInRange,
  updateExpense,
} from '@roman-mik/kapa-core/pocket/queries';
import { ref, watch } from 'vue';
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
  const expenses = ref<ExpenseView[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      expenses.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const month = currentMonth(new Date(), currentSpace.timezone);
      const { startUtc, endUtc } = monthWindow(month, currentSpace.timezone);
      expenses.value = await listExpensesInRange(supabase, currentSpace.id, startUtc, endUtc);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load expenses.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  async function add(expense: NewExpense): Promise<void> {
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
    await refresh();
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
    const outcome = await updateExpense(supabase, expenseId, patch, expectedUpdatedAt);
    await refresh();
    return outcome;
  }

  async function remove(expenseId: string, expectedUpdatedAt: string): Promise<MutationOutcome> {
    const outcome = await deleteExpense(supabase, expenseId, expectedUpdatedAt);
    await refresh();
    return outcome;
  }

  // Interim behavior: writes immediately with today's date (spentAt omitted
  // from `add()` defaults to now). A later pass will replace this call site
  // with a push to a prefilled Add sheet instead of a direct write —
  // duplicate()'s data contract (amount/currency/category/note) won't change.
  async function duplicate(row: ExpenseView): Promise<void> {
    await add({
      amountMinor: row.amount_minor ?? 0,
      currency: row.currency ?? 'RSD',
      categoryId: row.category_id,
      note: row.note,
    });
  }

  return { expenses, loading, error, refresh, add, update, remove, duplicate };
}
