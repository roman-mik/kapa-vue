import { getWorkCalendar } from '@roman-mik/kapa-core/horizon/queries';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';

export function useWorkCalendar() {
  return useSpaceQuery({
    resource: 'workCalendar',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => getWorkCalendar(supabase, spaceId),
  });
}
