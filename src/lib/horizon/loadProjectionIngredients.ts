import { addDays, loadProjectionInput } from '@roman-mik/kapa-core/horizon';
import { getPaymentTrackingState } from '@roman-mik/kapa-core/horizon/queries';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import type { SupabaseClient } from '@supabase/supabase-js';
import { queryCache } from '@/lib/serverState/queryCache';
import { useSessionStore } from '@/stores/session';
/** Matching ranges share the same revisioned ingredients across baseline/draft consumers. */
export async function loadProjectionIngredients(
  client: SupabaseClient,
  spaceId: string,
  timezone: string,
  horizonDays: number,
  spendMode?: 'cap' | 'runRate'
) {
  const now = new Date();
  const from = zonedDateKey(now, timezone);
  const to = addDays(from, horizonDays);
  const userId = useSessionStore().user?.id;
  if (!userId) throw new Error('Sign in before loading a forecast.');
  const handle = queryCache.use({
    key: [userId, spaceId, 'projectionIngredients', from, to, timezone, spendMode ?? 'current'],
    staleTimeMs: 30_000,
    load: async () => {
      const tracking = await getPaymentTrackingState(client, spaceId);
      return loadProjectionInput(client, spaceId, {
        now,
        timeZone: timezone,
        range: { from, to },
        lifecycle: !!tracking,
        spendMode,
      });
    },
  });
  const result = await handle.fetch();
  if (handle.error.value || !result)
    throw new Error(handle.error.value ?? 'Forecast could not be loaded.');
  return result;
}
export type ProjectionIngredients = Awaited<ReturnType<typeof loadProjectionInput>>;
