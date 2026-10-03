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
import { computed } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
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
  const month = computed(() =>
    space.currentSpace ? currentMonth(new Date(), space.currentSpace.timezone) : ''
  );
  const query = useSpaceQuery<OneOffEvent[]>({
    resource: 'oneOffEvents',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listOneOffEvents(supabase, spaceId),
  });
  const allEvents = computed(() => query.data.value ?? []);

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
    const invalidate = query.invalidate;
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
    await invalidate();
  }

  async function update(input: OneOffEventEdit): Promise<void> {
    const invalidate = query.invalidate;
    await updateOneOffEvent(supabase, input.id, {
      name: input.name,
      category: input.category,
      currency: input.currency,
      account_id: input.accountId,
      amount_minor: input.amountMinor,
      date: input.date,
      direction: input.direction,
    });
    await invalidate();
  }

  async function remove(id: string): Promise<void> {
    const invalidate = query.invalidate;
    await deleteOneOffEvent(supabase, id);
    await invalidate();
  }

  return {
    monthOneOffs,
    convertibles,
    month,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    add,
    update,
    remove,
  };
}

export { SPEND_CATEGORIES, deleteOneOffEvent };
