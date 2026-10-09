import { mount, flushPromises } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import { describe, expect, it } from 'vite-plus/test';
import AppSwitcher from './AppSwitcher.vue';
import { useCautiousScenarioStore } from '@/stores/cautiousScenario';

async function setup(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/pocket', name: 'home', component: {} },
      { path: '/pocket/history', component: {} },
      { path: '/settings', component: {} },
      { path: '/horizon', name: 'horizon-today', component: {} },
      { path: '/horizon/timeline', component: {} },
    ],
  });
  const pinia = createPinia();
  setActivePinia(pinia);
  await router.push(path);
  await router.isReady();
  const wrapper = mount(AppSwitcher, { global: { plugins: [router, pinia] } });
  return { router, wrapper };
}

describe('app navigation', () => {
  it.each(['/pocket/history?category=food', '/settings'])(
    'switches from %s to Horizon and back',
    async (path) => {
      const { router, wrapper } = await setup(path);
      expect(wrapper.get('nav').attributes('aria-label')).toBe('Apps');
      expect(wrapper.find('[role="tab"]').exists()).toBe(false);
      expect(wrapper.get('a[aria-current="true"]').text()).toBe('Pocket');
      await wrapper.get('a[href="/horizon"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.name).toBe('horizon-today');
      expect(wrapper.get('a[aria-current="true"]').text()).toBe('Horizon');
      await wrapper.get('a[href="/pocket"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.name).toBe('home');
    }
  );

  it.each(['/pocket/history?category=food', '/horizon/timeline?range=6m'])(
    'keeps the current app route and query at %s',
    async (path) => {
      const { router, wrapper } = await setup(path);
      await wrapper.get('a[aria-current="true"]').trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.fullPath).toBe(path);
    }
  );

  it('preserves the household-bound cautious draft through app switching and browser history', async () => {
    const { router, wrapper } = await setup('/horizon/timeline');
    const scenario = useCautiousScenarioStore();
    scenario.bind('test-user:test-household');
    scenario.mode = 'cautious';
    scenario.draft.dailySpend = { amountMinor: 20, reason: 'Navigation trial', currency: 'RSD' };
    const before = JSON.parse(JSON.stringify(scenario.$state));
    await wrapper.get('a[href="/pocket"]').trigger('click');
    await flushPromises();
    router.back();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/horizon/timeline');
    expect(scenario.$state).toEqual(before);
    router.forward();
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/pocket');
    expect(scenario.$state).toEqual(before);
  });
});
