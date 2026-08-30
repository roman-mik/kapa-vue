import { BREAKPOINT } from '@roman-mik/kapa-core/theme';
import { effectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useViewport } from './useViewport';

interface MockMql {
  matches: boolean;
  media: string;
  listeners: Array<(event: { matches: boolean }) => void>;
  addEventListener: (type: string, listener: (event: { matches: boolean }) => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

function mockMatchMedia(matches: boolean): MockMql {
  const mql: MockMql = {
    matches,
    media: `(min-width: ${BREAKPOINT.lg}px)`,
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
  return mql;
}

describe('useViewport', () => {
  let scope: ReturnType<typeof effectScope>;
  let mql: MockMql;

  beforeEach(() => {
    scope = effectScope();
    mql = mockMatchMedia(false);
  });

  afterEach(() => {
    scope.stop();
    vi.unstubAllGlobals();
  });

  it('uses the lg breakpoint as the desktop threshold', () => {
    mockMatchMedia(true);
    const captured = window.matchMedia('');
    expect(captured.media).toBe(`(min-width: ${BREAKPOINT.lg}px)`);
  });

  it('reflects matchMedia at creation', () => {
    mql.matches = true;
    const { isDesktop } = scope.run(() => useViewport())!;
    expect(isDesktop.value).toBe(true);
  });

  it('flips when the media query change event fires', () => {
    const { isDesktop } = scope.run(() => useViewport())!;
    expect(isDesktop.value).toBe(false);

    mql.listeners.forEach((l) => l({ matches: true }));
    expect(isDesktop.value).toBe(true);

    mql.listeners.forEach((l) => l({ matches: false }));
    expect(isDesktop.value).toBe(false);
  });

  it('defaults to non-desktop when matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { isDesktop } = scope.run(() => useViewport())!;
    expect(isDesktop.value).toBe(false);
  });
});
