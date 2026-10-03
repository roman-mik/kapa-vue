import { getSettings } from '@roman-mik/kapa-core/horizon/queries';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';

export function useHorizonSettingsResource() {
  return useSpaceQuery({
    resource: 'horizonSettings',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => getSettings(supabase, spaceId),
  });
}
