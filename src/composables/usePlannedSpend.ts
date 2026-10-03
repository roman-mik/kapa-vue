import { plannedSpendMonthlyMinor, type ChargeCadence } from '@roman-mik/kapa-core/horizon';
import {
  archivePlannedSpend,
  createPlannedSpend,
  listPlannedSpend,
  updatePlannedSpend,
  type MutationOutcome,
  type PlannedSpend,
  type PlannedSpendUpdate,
} from '@roman-mik/kapa-core/horizon/queries';
import { currentMonth, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/** Fields the create-only planned-spend form collects. */
export interface NewPlannedSpend {
  name: string;
  categoryId: string | null;
  currency: Currency;
  accountId: string;
  dailyAmountMinor: number;
  chargeCadence: ChargeCadence;
  capMinor: number | null;
  /** 'YYYY-MM-DD'. */
  startDate: string;
  /** 'YYYY-MM-DD', or null for no end date. */
  endDate: string | null;
}

/** A planned-spend item with its current-month total, ready for the Money-out list. */
export interface PlannedSpendMonth extends PlannedSpend {
  monthlyMinor: number;
}

export function usePlannedSpend() {
  const space = useSpaceStore();
  const month = computed(() =>
    space.currentSpace ? currentMonth(new Date(), space.currentSpace.timezone) : ''
  );
  const query = useSpaceQuery<PlannedSpend[]>({
    resource: 'plannedSpend',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listPlannedSpend(supabase, spaceId),
  });
  const allItems = computed(() => query.data.value ?? []);

  // Archived items drop out of Money-out; they stay in the DB so projections
  // keep their references (same contract as accounts/obligations/streams).
  const items = computed(() => allItems.value.filter((i) => !i.archived));

  const itemsWithMonth = computed<PlannedSpendMonth[]>(() => {
    if (!month.value) return [];
    return items.value.map((item) => ({
      ...item,
      monthlyMinor: plannedSpendMonthlyMinor({
        dailyAmountMinor: item.daily_amount_minor,
        chargeCadence: item.charge_cadence as ChargeCadence,
        capMinor: item.cap_minor,
        startDate: item.start_date,
        endDate: item.end_date,
        month: month.value,
      }),
    }));
  });

  const convertibles = computed(() =>
    itemsWithMonth.value.map((i) => ({
      id: i.id,
      currency: i.currency as Currency,
      amountMinor: i.monthlyMinor,
    }))
  );

  async function add(input: NewPlannedSpend): Promise<void> {
    const invalidate = query.invalidate;
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await createPlannedSpend(supabase, {
      space_id: spaceId,
      account_id: input.accountId,
      category_id: input.categoryId,
      currency: input.currency,
      name: input.name,
      daily_amount_minor: input.dailyAmountMinor,
      charge_cadence: input.chargeCadence,
      cap_minor: input.capMinor,
      start_date: input.startDate,
      end_date: input.endDate,
    });
    await invalidate();
  }

  // `expectedUpdatedAt` is the row's `updated_at` as this client last read
  // it — kapa-core scopes the write to it and reports a conflict instead of
  // clobbering another member's change. Conflicts don't throw: the list is
  // refreshed either way and the outcome is returned for the view to surface.
  async function update(
    id: string,
    patch: PlannedSpendUpdate,
    expectedUpdatedAt: string
  ): Promise<MutationOutcome> {
    const invalidate = query.invalidate;
    const outcome = await updatePlannedSpend(supabase, id, patch, expectedUpdatedAt);
    await invalidate();
    return outcome;
  }

  async function archive(id: string, expectedUpdatedAt: string): Promise<MutationOutcome> {
    const invalidate = query.invalidate;
    const outcome = await archivePlannedSpend(supabase, id, expectedUpdatedAt);
    await invalidate();
    return outcome;
  }

  return {
    itemsWithMonth,
    convertibles,
    month,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    add,
    update,
    archive,
  };
}
