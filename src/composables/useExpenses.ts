import type { ExpenseUpdate, ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import {
  addExpense,
  deleteExpense,
  listExpenses,
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

// Full expense history for the current space — no arithmetic, this is CRUD
// only via kapa-core's query layer. usePocketHome fetches its own
// month-scoped slice for deriving figures; this composable is for the
// history screen's full list.
export function useExpenses() {
  const space = useSpaceStore();
  const session = useSessionStore();
  const expenses = ref<ExpenseView[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) {
      expenses.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      expenses.value = await listExpenses(supabase, spaceId);
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

  async function update(expenseId: string, patch: ExpenseUpdate): Promise<void> {
    await updateExpense(supabase, expenseId, patch);
    await refresh();
  }

  async function remove(expenseId: string): Promise<void> {
    await deleteExpense(supabase, expenseId);
    await refresh();
  }

  return { expenses, loading, error, refresh, add, update, remove };
}
