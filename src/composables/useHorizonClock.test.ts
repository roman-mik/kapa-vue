import { createPinia, setActivePinia } from 'pinia';
import { effectScope, nextTick } from 'vue';
import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test';
import { useHorizonClock } from './useHorizonClock';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
const { invalidateResources } = vi.hoisted(() => ({
  invalidateResources: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/serverState/invalidation', () => ({ invalidateResources }));
let scope: ReturnType<typeof effectScope>;
beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-04T23:59:45Z'));
  useSpaceStore().spaces = [
    { id: 'home', name: 'Home', currency: 'RSD', timezone: 'UTC', created_at: '' },
    { id: 'other', name: 'Other', currency: 'RSD', timezone: 'Europe/Belgrade', created_at: '' },
  ];
  useSpaceStore().currentSpaceId = 'home';
  useSessionStore().user = { id: 'user' } as never;
  scope = effectScope();
});
afterEach(() => {
  scope.stop();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('advances the active zoned date across midnight and stops its shared timer', async () => {
  const clock = scope.run(() => useHorizonClock())!;
  expect(clock.today.value).toBe('2026-10-04');
  vi.advanceTimersByTime(30_000);
  await nextTick();
  expect(clock.today.value).toBe('2026-10-05');
  scope.stop();
  expect(vi.getTimerCount()).toBe(0);
});
it('space changes use the new timezone before returning stale data', () => {
  const clock = scope.run(() => useHorizonClock())!;
  expect(clock.today.value).toBe('2026-10-04');
  useSpaceStore().currentSpaceId = 'other';
  expect(clock.today.value).toBe('2026-10-05');
});
it('stale return refreshes only the active space once, with no quick-return refresh', () => {
  scope.run(() => useHorizonClock());
  const visible = vi.spyOn(document, 'visibilityState', 'get');
  visible.mockReturnValue('hidden');
  document.dispatchEvent(new Event('visibilitychange'));
  vi.advanceTimersByTime(60_000);
  useSpaceStore().currentSpaceId = 'other';
  visible.mockReturnValue('visible');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(invalidateResources).toHaveBeenCalledExactlyOnceWith('user', 'other', 'paymentTracking');
  document.dispatchEvent(new Event('visibilitychange'));
  expect(invalidateResources).toHaveBeenCalledTimes(1);
});
