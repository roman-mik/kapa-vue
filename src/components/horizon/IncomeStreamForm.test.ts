import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { buildProjection, type ProjectionInput } from '@roman-mik/kapa-core/horizon';
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import { spliceDraft } from '@/lib/horizon/dryRunProjection';
import { useSpaceStore } from '@/stores/space';
import type { NewIncomeStream } from '@/composables/useIncomeStreams';
import IncomeStreamForm from './IncomeStreamForm.vue';
import type { IncomeFormDraft, SchedulePreviewItem } from '@/lib/horizon/incomeEditor';
import SchedulePreview from './SchedulePreview.vue';

afterEach(() => vi.useRealTimers());
const calendar = { workingWeekdays: [1, 2, 3, 4, 5], holidays: ['2026-10-15'] };
beforeEach(() => {
  setActivePinia(createPinia());
  const space = useSpaceStore();
  space.spaces = [{ id: 's', currency: 'RSD', timezone: 'UTC' } as never];
  space.currentSpaceId = 's';
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-03T12:00:00Z'));
});

function form(seed: Partial<IncomeFormDraft> = {}, save = vi.fn().mockResolvedValue(undefined)) {
  return {
    save,
    wrapper: mount(IncomeStreamForm, {
      props: {
        accounts: [{ id: 'a', name: 'Wallet' } as Account],
        spaceCurrency: 'RSD',
        calendar,
        defaultStartDate: '2026-10-03',
        recurringOnly: true,
        save,
        seed: { name: 'Salary', accountId: 'a', amount: '1000', startDate: '2026-10-03', ...seed },
      },
    }),
  };
}

describe('Income creation', () => {
  it.each([
    { paymentRule: 'dayOfMonth', payDay: '15' },
    { paymentRule: 'monthEnd' },
    { paymentRule: 'semiMonthly' },
    { kind: 'hourly', hourlyRate: '10', hoursPerDay: '8', earningPeriod: 'monthly', lagDays: '2' },
    {
      kind: 'hourly',
      hourlyRate: '10',
      hoursPerDay: '8',
      earningPeriod: 'semiMonthly',
      lagDays: '2',
    },
  ] as Partial<IncomeFormDraft>[])(
    'receipt dates agree with the saved projection: %j',
    async (seed) => {
      const { wrapper, save } = form(seed);
      const previewDates = (
        wrapper.findComponent(SchedulePreview).props() as { items: SchedulePreviewItem[] }
      ).items.map((i) => i.date);
      await wrapper.find('form').trigger('submit');
      await flushPromises();
      const input = save.mock.calls[0]![0] as NewIncomeStream;
      const base: ProjectionInput = {
        accounts: [
          {
            id: 'a',
            currency: 'RSD',
            current_balance_minor: 0,
            include_in_total: true,
            archived: false,
          },
        ],
        incomeStreams: [],
        obligations: [],
        oneOffEvents: [],
        plannedSpend: [],
        pocketSpend: { actuals: [], forward: [] },
        todayKey: '2026-10-03',
        range: { from: '2026-10-03', to: '2027-04-30' },
        reportingCurrency: 'RSD',
        rates: [],
        calendar,
        eventOrder: 'income,oneOffIn,obligation,plannedSpend,oneOffOut',
      };
      const events = buildProjection(spliceDraft(base, { kind: 'incomeStream', value: input }))
        .value.events;
      expect(events.slice(0, 6).map((e) => e.date)).toEqual(previewDates);
      expect(input.recurrence).toBe('recurring');
      wrapper.unmount();
      vi.useRealTimers();
    }
  );

  it.each([
    { payDay: '0' },
    { payDay: '32' },
    { payDay: '1.5' },
    { kind: 'hourly', hourlyRate: '10', hoursPerDay: '0' },
    { kind: 'hourly', hourlyRate: '10', hoursPerDay: '8', lagDays: '-1' },
  ] as Partial<IncomeFormDraft>[])('rejects invalid income fields: %j', async (seed) => {
    const { wrapper, save } = form(seed);
    await wrapper.find('form').trigger('submit');
    expect(save).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').exists()).toBe(true);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('keeps amounts and schedules after a failed save', async () => {
    const { wrapper } = form({}, vi.fn().mockRejectedValue(new Error('Offline')));
    const before = wrapper.findAll('input').map((i) => i.element.value);
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Offline');
    expect(wrapper.findAll('input').map((i) => i.element.value)).toEqual(before);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('updates receipt preview when start date changes', async () => {
    const { wrapper } = form();
    await wrapper.find('input[type="date"]').setValue('2026-12-01');
    expect(
      (wrapper.findComponent(SchedulePreview).props() as { items: SchedulePreviewItem[] }).items[0]
        ?.date
    ).toBe('2026-12-15');
    wrapper.unmount();
    vi.useRealTimers();
  });
});
