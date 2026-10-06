import { mount } from '@vue/test-utils';
import { expect, it } from 'vite-plus/test';
import ForecastStatusNotice from './ForecastStatusNotice.vue';
import type { ForecastAssessment } from '@roman-mik/kapa-core/horizon';
const assessment: ForecastAssessment = {
  complete: false,
  issues: [{ code: 'historyCoverage', message: 'Confirm recorded spending', repair: 'history' }],
  provenance: {
    spaceId: 's',
    timeZone: 'UTC',
    generatedAt: '2026-10-06',
    fetchedAt: '2026-10-06',
    revision: '1:0',
    range: { from: '2026-10-06', to: '2026-11-06' },
    spendMode: 'runRate',
    spendingWindow: { from: '2026-07-06', to: '2026-10-05' },
    historyReview: null,
    includedAccountIds: ['a'],
    excludedAccountIds: ['b'],
    observationDates: [],
    fxDates: [],
  },
};
it('shows partial status and repair, suppressing complete wording during refresh failure', async () => {
  const wrapper = mount(ForecastStatusNotice, {
    props: { assessment },
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } },
  });
  expect(wrapper.text()).toContain('Forecast incomplete');
  expect(wrapper.text()).toContain('Review recorded history');
  wrapper.unmount();
  const updating = mount(ForecastStatusNotice, {
    props: { assessment: { ...assessment, complete: true, issues: [] }, loading: true },
    global: { stubs: { RouterLink: true } },
  });
  expect(updating.text()).toContain('Updating forecast');
  expect(updating.text()).not.toContain('Forecast covers');
  updating.unmount();
  const failed = mount(ForecastStatusNotice, {
    props: { assessment: { ...assessment, complete: true, issues: [] }, error: 'offline' },
    global: { stubs: { RouterLink: true } },
  });
  expect(failed.text()).toContain('Forecast unavailable');
  expect(failed.text()).not.toContain('Forecast covers');
  failed.unmount();
});
