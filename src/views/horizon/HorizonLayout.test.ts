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

// The shell is gate-only; stub the router primitives, the app switcher (which
// needs a live router's useRoute), both nav shells, and the entry sheet
// (which fetch real data via composables / need an active Pinia) so the
// layout mounts without a real session, router wiring, or backend.
const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div class="router-view-stub" />' },
  AppSwitcher: { template: '<div class="app-switcher-stub" />' },
  HorizonRail: { template: '<div class="rail-stub" aria-label="Horizon" />' },
  HorizonTabBar: { template: '<div class="tabbar-stub" aria-label="Horizon" />' },
  EntrySheet: { template: '<div class="entry-sheet-stub" />' },
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
    expect(wrapper.find('.rail-stub').exists()).toBe(true);
    expect(wrapper.find('.tabbar-stub').exists()).toBe(false);
  });

  it('shows the router view and tab bar on a narrow viewport', () => {
    mockViewport(false);
    const wrapper = mount(HorizonLayout, { global: { stubs } });

    expect(wrapper.find('[aria-label="Horizon"]').exists()).toBe(true);
    expect(wrapper.find('.shell').exists()).toBe(false);
    expect(wrapper.find('.router-view-stub').exists()).toBe(true);
    expect(wrapper.find('.tabbar-stub').exists()).toBe(true);
    expect(wrapper.find('.rail-stub').exists()).toBe(false);
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
