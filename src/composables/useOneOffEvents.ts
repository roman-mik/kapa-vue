import { SPEND_CATEGORIES, type SpendCategory } from '@roman-mik/kapa-core/horizon';
import {
  createOneOffEvent,
  deleteOneOffEvent,
  listOneOffEvents,
  updateOneOffEvent,
  type OneOffDirection,
  type OneOffEvent,
} from '@roman-mik/kapa-core/horizon/queries';
import { currentMonth, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/**
 * A one-off event's category — the full ten-value `spend_category` set,
 * including the windfall pair (`gift`/`bonus`) that obligations reject.
 */
export type OneOffCategory = SpendCategory;

export const ONE_OFF_CATEGORY_LABELS: Record<OneOffCategory, string> = {
  housing: 'Housing',
  utilities: 'Utilities',
  debt: 'Debt',
  subscriptions: 'Subscriptions',
  insurance: 'Insurance',
  transport: 'Transport',
  family: 'Family',
  gift: 'Gift',
  bonus: 'Bonus',
  other: 'Other',
};

/**
 * Fields the create-only one-off form collects. No schedules: a one-off is a
 * single dated amount plus a direction ('in' for windfalls, 'out' for costs).
 */
export interface NewOneOffEvent {
  name: string;
  category: OneOffCategory;
  currency: Currency;
  accountId: string;
  /** 'YYYY-MM-DD' — the event's exact date. */
  date: string;
  amountMinor: number;
  direction: OneOffDirection;
}

/** The edit form's input: NewOneOffEvent plus identity. No lock (no `updated_at`). */
export interface OneOffEventEdit extends NewOneOffEvent {
  id: string;
}

export function useOneOffEvents() {
  const space = useSpaceStore();
  const allEvents = ref<OneOffEvent[]>([]);
  const month = ref('');
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      allEvents.value = [];
      month.value = '';
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      month.value = currentMonth(new Date(), currentSpace.timezone);
      allEvents.value = await listOneOffEvents(supabase, currentSpace.id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load one-off events.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  /** The month's one-offs, already ordered by date (the query orders by `date`). */
  const monthOneOffs = computed(() =>
    month.value ? allEvents.value.filter((e) => e.date.startsWith(month.value)) : []
  );

  const convertibles = computed(() =>
    monthOneOffs.value.map((e) => ({
      id: e.id,
      currency: e.currency as Currency,
      amountMinor: e.amount_minor,
      asOfDate: e.date,
    }))
  );

  /** Single insert — the composable equivalent of a rollback is unnecessary. */
  async function add(input: NewOneOffEvent): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await createOneOffEvent(supabase, {
      space_id: spaceId,
      account_id: input.accountId,
      currency: input.currency,
      name: input.name,
      category: input.category,
      amount_minor: input.amountMinor,
      date: input.date,
      direction: input.direction,
    });
    await refresh();
  }

  async function update(input: OneOffEventEdit): Promise<void> {
    await updateOneOffEvent(supabase, input.id, {
      name: input.name,
      category: input.category,
      currency: input.currency,
      account_id: input.accountId,
      amount_minor: input.amountMinor,
      date: input.date,
      direction: input.direction,
    });
    await refresh();
  }

  async function remove(id: string): Promise<void> {
    await deleteOneOffEvent(supabase, id);
    await refresh();
  }

  return { monthOneOffs, convertibles, month, loading, error, refresh, add, update, remove };
}

export { SPEND_CATEGORIES, deleteOneOffEvent };
