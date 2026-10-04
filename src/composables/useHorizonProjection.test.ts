import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { getPaymentTrackingState } from '@roman-mik/kapa-core/horizon/queries';
import { useHorizonProjection } from './useHorizonProjection';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { queryCache } from '@/lib/serverState/queryCache';
import { invalidateResources } from '@/lib/serverState/invalidation';

const { projectionForRange } = vi.hoisted(() => ({ projectionForRange: vi.fn() }));
vi.mock('@roman-mik/kapa-core/horizon', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon')>()),
  projectionForRange,
}));

vi.mock('@roman-mik/kapa-core/horizon/queries', async (original) => ({
  ...(await original<typeof import('@roman-mik/kapa-core/horizon/queries')>()),
  getPaymentTrackingState: vi.fn().mockResolvedValue(null),
}));

describe('shared Horizon projections', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    queryCache.clear();
    vi.clearAllMocks();
    vi.mocked(getPaymentTrackingState).mockResolvedValue(null);
    useSessionStore().user = { id: 'u1' } as never;
    const space = useSpaceStore();
    space.spaces = [
      { id: 's1', name: 'Home', currency: 'RSD', timezone: 'Europe/Belgrade', created_at: '' },
    ];
    space.currentSpaceId = 's1';
    projectionForRange.mockResolvedValue({ value: { days: [], events: [] }, unconverted: [] });
  });

  it('enables durable cashflow only in spaces that started tracking', async () => {
    vi.mocked(getPaymentTrackingState).mockResolvedValue({ space_id: 's1' } as never);
    await useHorizonProjection(() => 90).refresh();
    expect(projectionForRange).toHaveBeenCalledWith(
      expect.anything(),
      's1',
      expect.objectContaining({ lifecycle: true })
    );
  });

  it('shares equal ranges, isolates another range and reuses a fresh earlier range', async () => {
    const offset = ref(90);
    const first = useHorizonProjection(() => offset.value);
    const second = useHorizonProjection(() => 90);
    await Promise.all([first.refresh(), second.refresh()]);
    expect(projectionForRange).toHaveBeenCalledTimes(1);
    offset.value = 180;
    await first.refresh();
    expect(projectionForRange).toHaveBeenCalledTimes(2);
    offset.value = 90;
    expect(first.data.value).toEqual(second.data.value);
    expect(projectionForRange).toHaveBeenCalledTimes(2);
  });

  it('refreshes every cached projection range after an account mutation', async () => {
    const first = useHorizonProjection(() => 90);
    const second = useHorizonProjection(() => 180);
    await Promise.all([first.refresh(), second.refresh()]);
    await invalidateResources('u1', 's1', 'accounts');
    expect(projectionForRange).toHaveBeenCalledTimes(4);
    await invalidateResources('u1', 'another-space', 'accounts');
    expect(projectionForRange).toHaveBeenCalledTimes(4);
  });
});
