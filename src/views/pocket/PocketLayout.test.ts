import { BREAKPOINT } from '@roman-mik/kapa-core/theme';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import PocketLayout from './PocketLayout.vue';

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

// The shell is gate-only, mirroring HorizonLayout.test.ts: stub the router
// primitives and both nav shells so the layout mounts without real
// composables/backend data.
const stubs = {
  RouterLink: { template: '<a><slot /></a>' },
  RouterView: { template: '<div class="router-view-stub" />' },
  PocketRail: { template: '<div class="rail-stub" aria-label="Pocket" />' },
  BottomTabBar: { template: '<div class="tabbar-stub" />' },
};

describe('PocketLayout mobile/desktop gate', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the full rail on a desktop viewport', () => {
    mockViewport(true);
    const wrapper = mount(PocketLayout, { global: { stubs } });
    expect(wrapper.find('.shell').exists()).toBe(true);
    expect(wrapper.find('.rail-stub').exists()).toBe(true);
    expect(wrapper.find('.tabbar-stub').exists()).toBe(false);
  });

  it('shows the router view and tab bar on a narrow viewport', () => {
    mockViewport(false);
    const wrapper = mount(PocketLayout, { global: { stubs } });

    expect(wrapper.find('.shell').exists()).toBe(false);
    expect(wrapper.find('.router-view-stub').exists()).toBe(true);
    expect(wrapper.find('.tabbar-stub').exists()).toBe(true);
    expect(wrapper.find('.rail-stub').exists()).toBe(false);
  });
});

describe('PocketLayout breakpoint threshold', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the lg breakpoint for the desktop media query', () => {
    mockViewport(false);
    mount(PocketLayout, { global: { stubs } });
    const called = vi.mocked(window.matchMedia).mock.calls[0]?.[0];
    expect(called).toBe(`(min-width: ${BREAKPOINT.lg}px)`);
  });
});
