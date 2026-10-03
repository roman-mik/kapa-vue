import { defineComponent, h, nextTick, ref } from 'vue';
import type { CurrencyBucket } from '@roman-mik/kapa-core/pocket';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { describe, it, expect, vi } from 'vite-plus/test';
import Notice from './ProjectionCompletenessNotice.vue';

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/horizon/accounts', name: 'horizon-accounts', component: { template: '<div />' } },
  ],
});
describe('forecast status', () => {
  it('retains keyboard focus during retry, blocks duplicates and returns focus to the forecast on recovery', async () => {
    const loading = ref(false),
      issues = ref<CurrencyBucket[]>([{ currency: 'EUR', amountMinor: 1000 }]);
    const retry = vi.fn();
    const Harness = defineComponent({
      setup: () => () =>
        h('main', [
          h('h1', { tabindex: -1 }, 'Forecast'),
          h(Notice, {
            currency: 'RSD',
            issues: issues.value,
            loading: loading.value,
            onRetry: retry,
          }),
        ]),
    });
    const wrapper = mount(Harness, { attachTo: document.body, global: { plugins: [router] } });
    const button = wrapper.find('button').element;
    button.focus();
    loading.value = true;
    await nextTick();
    expect(document.activeElement).toBe(button);
    await wrapper.find('button').trigger('click');
    expect(retry).not.toHaveBeenCalled();
    loading.value = false;
    issues.value = [];
    await nextTick();
    expect(document.activeElement).toBe(wrapper.find('h1').element);
    wrapper.unmount();
  });

  it('lists native currency, explains partial results and links to rates', async () => {
    const w = mount(Notice, {
      props: {
        loading: false,
        error: null,
        currency: 'RSD',
        issues: [{ currency: 'EUR', amountMinor: 12500 }],
      },
      global: { plugins: [router] },
    });
    expect(w.text()).toContain('Forecast incomplete');
    expect(w.text()).toContain('(EUR)');
    expect(w.text()).toContain('not a net shortfall');
    expect(w.find('a').attributes('href')).toBe('/horizon/accounts');
    await w.find('button').trigger('click');
    expect(w.emitted('retry')).toHaveLength(1);
    w.unmount();
    const loading = mount(Notice, {
      props: { currency: 'RSD', loading: true },
      global: { plugins: [router] },
    });
    expect(loading.find('button').attributes('aria-disabled')).toBe('true');
    expect(loading.text()).not.toContain('(EUR)');
    const recovered = mount(Notice, {
      props: { currency: 'RSD', issues: [] },
      global: { plugins: [router] },
    });
    expect(recovered.find('section').exists()).toBe(false);
  });
  it('offers recovery after failure without exposing technical errors', () => {
    const w = mount(Notice, {
      props: { currency: 'RSD', error: 'database exception' },
      global: { plugins: [router] },
    });
    expect(w.text()).toContain('Forecast unavailable');
    expect(w.text()).not.toContain('database exception');
  });
});
