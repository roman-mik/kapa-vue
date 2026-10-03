import {
  addHoliday,
  deleteHoliday,
  listHolidays,
  setEventOrder,
  setSpendMode,
  upsertWorkCalendar,
  type EventOrder,
  type Holiday,
  type HolidayMutationOutcome,
  type SpaceSettings,
  type SpendMode,
} from '@roman-mik/kapa-core/horizon/queries';
import { useCap } from '@/composables/useCap';
import { useHorizonSettingsResource } from '@/composables/useHorizonSettingsResource';
import { useWorkCalendar } from '@/composables/useWorkCalendar';
import { queryCache } from '@/lib/serverState/queryCache';
import { useSessionStore } from '@/stores/session';
import { computed, ref } from 'vue';
import { useSpaceQuery } from '@/composables/useSpaceQuery';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/**
 * Backs the Horizon settings screen (H21): same-day event order (D3/D4),
 * forward-spend mode (H15), the work calendar + holidays (H5), and the cap
 * the A-CAP-1 note reflects. Loads settings, calendar, holidays and the cap
 * on space change; every mutation is an immediate upsert/insert/delete (no
 * save button) mirroring the Accounts/Money-in pattern.
 */
export function useHorizonSettings() {
  const space = useSpaceStore();
  const query = useHorizonSettingsResource();
  const calendar = useWorkCalendar();
  const cap = useCap();
  const holidayQuery = useSpaceQuery({
    resource: 'holidays',
    staleTimeMs: 30_000,
    load: ({ spaceId }) => listHolidays(supabase, spaceId),
  });
  const settings = computed<SpaceSettings | null>({
    get: () => query.data.value ?? null,
    set: (settings) => {
      if (settings) query.setData(() => settings);
    },
  });
  const workingWeekdays = computed<number[]>({
    get: () => calendar.data.value?.workingWeekdays ?? [],
    set: (workingWeekdays) => {
      if (calendar.data.value) calendar.setData((data) => ({ ...data!, workingWeekdays }));
    },
  });
  const holidays = computed<Holiday[]>({
    get: () => holidayQuery.data.value ?? [],
    set: (holidays) => {
      holidayQuery.setData(() => holidays);
    },
  });
  const capMinor = computed(() => cap.cap.value?.monthly_cap_minor ?? null);
  const saveError = ref<string | null>(null);
  const error = computed({
    get: () =>
      saveError.value ??
      query.error.value ??
      calendar.error.value ??
      holidayQuery.error.value ??
      cap.error.value,
    set: (value) => {
      saveError.value = value;
    },
  });
  const loading = computed(
    () =>
      query.loading.value ||
      calendar.loading.value ||
      holidayQuery.loading.value ||
      cap.loading.value
  );
  const refresh = async () => {
    await Promise.all([query.refresh(), calendar.refresh(), holidayQuery.refresh(), cap.refresh()]);
  };
  async function refreshProjection(spaceId: string) {
    const userId = useSessionStore().user?.id;
    if (userId) await queryCache.invalidate([userId, spaceId, 'projection']);
  }

  async function saveEventOrder(order: EventOrder): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId || !settings.value) return;
    try {
      await setEventOrder(supabase, spaceId, order);
      if (space.currentSpaceId !== spaceId) return;
      settings.value = { ...settings.value, event_order: order };
      error.value = null;
      await refreshProjection(spaceId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't save event order.";
    }
  }

  async function saveSpendMode(mode: SpendMode): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId || !settings.value) return;
    try {
      await setSpendMode(supabase, spaceId, mode);
      if (space.currentSpaceId !== spaceId) return;
      settings.value = { ...settings.value, spend_mode: mode };
      error.value = null;
      await refreshProjection(spaceId);
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't save spend mode.";
    }
  }

  async function saveWorkCalendar(weekdays: number[]): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    try {
      await upsertWorkCalendar(supabase, spaceId, weekdays);
      if (space.currentSpaceId !== spaceId) return;
      workingWeekdays.value = weekdays;
      error.value = null;
      await calendar.invalidate();
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't save work calendar.";
    }
  }

  async function addHolidayForSpace(date: string, name: string): Promise<HolidayMutationOutcome> {
    const invalidate = holidayQuery.invalidate;
    const spaceId = space.currentSpaceId;
    if (!spaceId) return { ok: false, reason: 'duplicate' };
    const outcome = await addHoliday(supabase, spaceId, { date, name });
    if (outcome.ok) await invalidate();
    return outcome;
  }

  async function removeHoliday(holidayId: string): Promise<void> {
    const invalidate = calendar.invalidate;
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await deleteHoliday(supabase, holidayId);
    if (space.currentSpaceId !== spaceId) {
      await invalidate();
      return;
    }
    holidays.value = holidays.value.filter((h) => h.id !== holidayId);
    await invalidate();
  }

  return {
    settings,
    workingWeekdays,
    holidays,
    capMinor,
    loading,
    error,
    refresh,
    saveEventOrder,
    saveSpendMode,
    saveWorkCalendar,
    addHolidayForSpace,
    removeHoliday,
  };
}
