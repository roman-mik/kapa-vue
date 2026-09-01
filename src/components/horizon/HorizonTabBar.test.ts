import { flushPromises, mount } from '@vue/test-utils';
import { createRouter, createWebHistory } from 'vue-router';
import { describe, expect, it } from 'vite-plus/test';
import { useEntrySheet } from '@/composables/useEntrySheet';
import HorizonTabBar from './HorizonTabBar.vue';

// Router so router-link resolves and the component's useRoute() reads a real
// route name — the active-tab logic branches on it.
function makeRouter() {
  return createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/horizon', name: 'horizon-today', component: { template: '<div />' } },
      { path: '/horizon/timeline', name: 'horizon-timeline', component: { template: '<div />' } },
      { path: '/horizon/money', name: 'horizon-money', component: { template: '<div />' } },
      { path: '/horizon/settings', name: 'horizon-settings', component: { template: '<div />' } },
      { path: '/horizon/money-in', name: 'horizon-money-in', component: { template: '<div />' } },
      { path: '/horizon/money-out', name: 'horizon-money-out', component: { template: '<div />' } },
    ],
  });
}

async function mountBar(routeName: string) {
  const router = makeRouter();
  await router.push({ name: routeName }).catch(() => undefined);
  await router.isReady();
  const wrapper = mount(HorizonTabBar, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('HorizonTabBar', () => {
  it('renders five tabs', async () => {
    const wrapper = await mountBar('horizon-today');
    const labels = wrapper.findAll('.label').map((n) => n.text());
    expect(labels).toEqual(['Today', 'Timeline', 'Money', 'Settings']);
    expect(wrapper.find('.tab.add').exists()).toBe(true);
  });

  it('highlights Today as active', async () => {
    const wrapper = await mountBar('horizon-today');
    expect(wrapper.find('.tab.today').classes()).toContain('active');
    expect(wrapper.find('.tab.money').classes()).not.toContain('active');
  });

  it('highlights Money on the money, money-in and money-out routes', async () => {
    for (const name of ['horizon-money', 'horizon-money-in', 'horizon-money-out']) {
      const wrapper = await mountBar(name);
      expect(wrapper.find('.tab.money').classes(), name).toContain('active');
    }
  });

  it('does not highlight Money on Timeline', async () => {
    const wrapper = await mountBar('horizon-timeline');
    expect(wrapper.find('.tab.timeline').classes()).toContain('active');
    expect(wrapper.find('.tab.money').classes()).not.toContain('active');
  });

  it('opens the entry sheet defaulting to "out" from a non-money route', async () => {
    useEntrySheet().close();
    const wrapper = await mountBar('horizon-today');
    await wrapper.find('.tab.add').trigger('click');
    const sheet = useEntrySheet();
    expect(sheet.isOpen.value).toBe(true);
    expect(sheet.defaultSide.value).toBe('out');
  });

  it('opens the entry sheet defaulting to "in" from /horizon/money?side=in', async () => {
    useEntrySheet().close();
    const router = makeRouter();
    await router.push({ name: 'horizon-money', query: { side: 'in' } });
    await router.isReady();
    const wrapper = mount(HorizonTabBar, { global: { plugins: [router] } });
    await flushPromises();
    await wrapper.find('.tab.add').trigger('click');
    const sheet = useEntrySheet();
    expect(sheet.isOpen.value).toBe(true);
    expect(sheet.defaultSide.value).toBe('in');
  });
});
