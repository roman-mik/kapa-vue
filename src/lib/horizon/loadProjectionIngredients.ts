import { addDays, loadProjectionInput } from '@roman-mik/kapa-core/horizon';
import { getPaymentTrackingState } from '@roman-mik/kapa-core/horizon/queries';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Baselines, trials and settings use the same canonical loader once tracking starts. */
export async function loadProjectionIngredients(
  client: SupabaseClient,
  spaceId: string,
  timezone: string,
  horizonDays: number
) {
  const now = new Date();
  const from = zonedDateKey(now, timezone);
  const tracking = await getPaymentTrackingState(client, spaceId);
  return loadProjectionInput(client, spaceId, {
    now,
    timeZone: timezone,
    range: { from, to: addDays(from, horizonDays) },
    lifecycle: !!tracking,
  });
}

export type ProjectionIngredients = Awaited<ReturnType<typeof loadProjectionInput>>;
