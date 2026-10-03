import type { Currency } from '@roman-mik/kapa-core/pocket';
import {
  archiveAccount,
  createAccount,
  listAccounts,
  updateAccount,
  type Account,
  type AccountType,
  type AccountUpdate,
  type MutationOutcome,
} from '@roman-mik/kapa-core/horizon/queries';
import { computed } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

export interface NewAccount {
  name: string;
  currency: Currency;
  balanceMinor: number;
  type: AccountType;
  includeInTotal: boolean;
}

export function useAccounts() {
  const query = useSpaceQuery<Account[]>({
    resource: 'accounts',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listAccounts(supabase, spaceId),
  });
  const allAccounts = computed(() => query.data.value ?? []);

  // Archived accounts drop out of the active list; they stay in the DB so
  // projections keep their references. The hero total no longer lives here —
  // H3's currency display (`useConvertedAmount`) computes the converted total,
  // since foreign accounts are now included via fx rates.
  const accounts = computed(() => allAccounts.value.filter((a) => !a.archived));

  async function add(input: NewAccount): Promise<void> {
    const invalidate = query.invalidate;
    const spaceId = useSpaceStore().currentSpaceId;
    if (!spaceId) return;
    await createAccount(supabase, {
      space_id: spaceId,
      name: input.name,
      currency: input.currency,
      current_balance_minor: input.balanceMinor,
      type: input.type,
      include_in_total: input.includeInTotal,
    });
    await invalidate();
  }

  // `expectedUpdatedAt` is the row's `updated_at` as this client last read
  // it — kapa-core scopes the write to it and reports a conflict instead of
  // clobbering another member's change. Conflicts don't throw: the list is
  // refreshed either way and the outcome is returned for the view to surface.
  async function update(
    accountId: string,
    patch: AccountUpdate,
    expectedUpdatedAt: string
  ): Promise<MutationOutcome> {
    const invalidate = query.invalidate;
    const outcome = await updateAccount(supabase, accountId, patch, expectedUpdatedAt);
    await invalidate();
    return outcome;
  }

  async function archive(accountId: string, expectedUpdatedAt: string): Promise<MutationOutcome> {
    const invalidate = query.invalidate;
    const outcome = await archiveAccount(supabase, accountId, expectedUpdatedAt);
    await invalidate();
    return outcome;
  }

  return {
    accounts,
    loading: query.loading,
    error: query.error,
    refresh: query.refresh,
    add,
    update,
    archive,
  };
}
