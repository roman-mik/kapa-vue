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
import { computed, ref, watch } from 'vue';
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
  const space = useSpaceStore();
  const allAccounts = ref<Account[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      allAccounts.value = [];
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      allAccounts.value = await listAccounts(supabase, currentSpace.id);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load accounts.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  // Archived accounts drop out of the active list; they stay in the DB so
  // projections keep their references. The hero total no longer lives here —
  // H3's currency display (`useConvertedAmount`) computes the converted total,
  // since foreign accounts are now included via fx rates.
  const accounts = computed(() => allAccounts.value.filter((a) => !a.archived));

  async function add(input: NewAccount): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await createAccount(supabase, {
      space_id: spaceId,
      name: input.name,
      currency: input.currency,
      current_balance_minor: input.balanceMinor,
      type: input.type,
      include_in_total: input.includeInTotal,
    });
    await refresh();
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
    const outcome = await updateAccount(supabase, accountId, patch, expectedUpdatedAt);
    await refresh();
    return outcome;
  }

  async function archive(accountId: string, expectedUpdatedAt: string): Promise<MutationOutcome> {
    const outcome = await archiveAccount(supabase, accountId, expectedUpdatedAt);
    await refresh();
    return outcome;
  }

  return { accounts, loading, error, refresh, add, update, archive };
}
