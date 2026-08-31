import {
  addHoliday,
  deleteHoliday,
  getSettings,
  getWorkCalendar,
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
import { getCap } from '@roman-mik/kapa-core/pocket/queries';
import { ref, watch } from 'vue';
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
  const settings = ref<SpaceSettings | null>(null);
  const workingWeekdays = ref<number[]>([]);
  const holidays = ref<Holiday[]>([]);
  const capMinor = ref<number | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function refresh(): Promise<void> {
    const currentSpace = space.currentSpace;
    if (!currentSpace) {
      settings.value = null;
      workingWeekdays.value = [];
      holidays.value = [];
      capMinor.value = null;
      return;
    }
    loading.value = true;
    error.value = null;
    try {
      const [settingsRow, calendar, holidayRows, cap] = await Promise.all([
        getSettings(supabase, currentSpace.id),
        getWorkCalendar(supabase, currentSpace.id),
        listHolidays(supabase, currentSpace.id),
        getCap(supabase, currentSpace.id),
      ]);
      settings.value = settingsRow;
      workingWeekdays.value = calendar.workingWeekdays;
      holidays.value = holidayRows;
      capMinor.value = cap?.monthly_cap_minor ?? null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't load settings.";
    } finally {
      loading.value = false;
    }
  }

  watch(() => space.currentSpaceId, refresh, { immediate: true });

  async function saveEventOrder(order: EventOrder): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId || !settings.value) return;
    try {
      await setEventOrder(supabase, spaceId, order);
      settings.value = { ...settings.value, event_order: order };
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't save event order.";
    }
  }

  async function saveSpendMode(mode: SpendMode): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId || !settings.value) return;
    try {
      await setSpendMode(supabase, spaceId, mode);
      settings.value = { ...settings.value, spend_mode: mode };
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't save spend mode.";
    }
  }

  async function saveWorkCalendar(weekdays: number[]): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    try {
      await upsertWorkCalendar(supabase, spaceId, weekdays);
      workingWeekdays.value = weekdays;
      error.value = null;
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Couldn't save work calendar.";
    }
  }

  async function addHolidayForSpace(date: string, name: string): Promise<HolidayMutationOutcome> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return { ok: false, reason: 'duplicate' };
    const outcome = await addHoliday(supabase, spaceId, { date, name });
    if (outcome.ok) await refresh();
    return outcome;
  }

  async function removeHoliday(holidayId: string): Promise<void> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return;
    await deleteHoliday(supabase, holidayId);
    holidays.value = holidays.value.filter((h) => h.id !== holidayId);
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
