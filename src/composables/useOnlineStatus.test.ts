import { effectScope } from 'vue';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import { useOnlineStatus } from './useOnlineStatus';

describe('useOnlineStatus', () => {
  let scope: ReturnType<typeof effectScope>;

  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    scope = effectScope();
  });

  afterEach(() => {
    scope.stop();
  });

  it('reflects navigator.onLine at creation', () => {
    const { isOnline } = scope.run(() => useOnlineStatus())!;
    expect(isOnline.value).toBe(true);
  });

  it('flips to false on a window "offline" event, and back on "online"', () => {
    const { isOnline } = scope.run(() => useOnlineStatus())!;

    window.dispatchEvent(new Event('offline'));
    expect(isOnline.value).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(isOnline.value).toBe(true);
  });

  it('stops reacting to events once every consumer has unmounted', () => {
    const { isOnline } = scope.run(() => useOnlineStatus())!;
    scope.stop();

    window.dispatchEvent(new Event('offline'));
    expect(isOnline.value).toBe(true);
  });
});
