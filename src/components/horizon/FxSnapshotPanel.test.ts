import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import type { FxRate } from '@roman-mik/kapa-core/pocket';
import FxSnapshotPanel from './FxSnapshotPanel.vue';

const eurRate: FxRate = {
  baseCurrency: 'EUR',
  quoteCurrency: 'RSD',
  rateE8: 11720000000,
  rateDate: '2026-08-01',
};

describe('FxSnapshotPanel', () => {
  it('shows a hint and no rows when no foreign currencies are in use', () => {
    const wrapper = mount(FxSnapshotPanel, {
      props: {
        spaceCurrency: 'RSD',
        currencies: [],
        rateFor: () => null,
        loading: false,
      },
    });
    expect(wrapper.text()).toContain('No foreign-currency accounts to convert.');
  });

  it('renders a pair, rate, and snapshot date for each currency with a covering rate', () => {
    const wrapper = mount(FxSnapshotPanel, {
      props: {
        spaceCurrency: 'RSD',
        currencies: ['EUR'],
        rateFor: () => eurRate,
        loading: false,
      },
    });
    expect(wrapper.text()).toContain('EUR → RSD');
    expect(wrapper.text()).toContain('117.2');
    expect(wrapper.text()).toContain('as of Sat, Aug 1');
  });

  it('flags a currency with no covering rate instead of hiding it', () => {
    const wrapper = mount(FxSnapshotPanel, {
      props: {
        spaceCurrency: 'RSD',
        currencies: ['USD'],
        rateFor: () => null,
        loading: false,
      },
    });
    expect(wrapper.text()).toContain('USD → RSD');
    expect(wrapper.text()).toContain('no rate available');
  });

  it('emits refresh when the button is clicked', async () => {
    const wrapper = mount(FxSnapshotPanel, {
      props: {
        spaceCurrency: 'RSD',
        currencies: [],
        rateFor: () => null,
        loading: false,
      },
    });
    await wrapper.find('button').trigger('click');
    expect(wrapper.emitted('refresh')).toHaveLength(1);
  });

  it('disables the button and relabels it while loading', () => {
    const wrapper = mount(FxSnapshotPanel, {
      props: {
        spaceCurrency: 'RSD',
        currencies: [],
        rateFor: () => null,
        loading: true,
      },
    });
    const button = wrapper.find('button');
    expect(button.attributes('disabled')).toBeDefined();
    expect(button.text()).toBe('Refreshing…');
  });
});
