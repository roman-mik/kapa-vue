import { BREAKPOINT } from '@roman-mik/kapa-core/theme';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import HorizonLayout from './HorizonLayout.vue';

interface MockMql {
  matches: boolean;
  listeners: Array<(event: { matches: boolean }) => void>;
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
  removeEventListener: () => void;
}

function mockViewport(matches: boolean): void {
  const mql: MockMql = {
    matches,
    listeners: [],
    addEventListener(_type, listener) {
      mql.listeners.push(listener);
    },
    removeEventListener() {},
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql)
  );
}

// The shell is gate-only; stub the router primitives, the app switcher
// (which needs a live router's useRoute), and TodayView (which fetches real
// data via composables) so the layout and rail mount without a real
// session, router wiring, or backend.
const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div class="router-view-stub" />' },
  AppSwitcher: { template: '<div class="app-switcher-stub" />' },
  TodayView: { template: '<div class="today-view-stub" />' },
};

describe('HorizonLayout mobile/desktop gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the full rail on a desktop viewport', () => {
    mockViewport(true);
    const wrapper = mount(HorizonLayout, { global: { stubs } });
    expect(wrapper.find('[aria-label="Horizon"]').exists()).toBe(true);
    expect(wrapper.find('.shell').exists()).toBe(true);
    expect(wrapper.text()).toContain('Timeline');
  });

  it('shows only Today on a narrow viewport', () => {
    mockViewport(false);
    const wrapper = mount(HorizonLayout, { global: { stubs } });

    expect(wrapper.find('[aria-label="Horizon"]').exists()).toBe(false);
    expect(wrapper.find('.shell').exists()).toBe(false);
    expect(wrapper.find('.today-view-stub').exists()).toBe(true);
  });
});

describe('HorizonLayout breakpoint threshold', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the lg breakpoint for the desktop media query', () => {
    mockViewport(false);
    mount(HorizonLayout, { global: { stubs } });
    const called = vi.mocked(window.matchMedia).mock.calls[0]?.[0];
    expect(called).toBe(`(min-width: ${BREAKPOINT.lg}px)`);
  });
});
