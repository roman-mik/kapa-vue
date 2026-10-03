import { listProjectionDismissals } from '@roman-mik/kapa-core/horizon/queries';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';

export function useProjectionDismissals() {
  return useSpaceQuery({
    resource: 'projectionDismissals',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listProjectionDismissals(supabase, spaceId),
  });
}
