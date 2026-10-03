import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vite-plus/test';
import { effectScope, reactive } from 'vue';
import { useCap } from './useCap';

const mocks = vi.hoisted(() => ({ get: vi.fn(), upsert: vi.fn(), space: vi.fn() }));
vi.mock('@roman-mik/kapa-core/pocket/queries', () => ({
  getCap: mocks.get,
  upsertCap: mocks.upsert,
}));
vi.mock('@/lib/supabase', () => ({ supabase: {} }));
vi.mock('@/stores/space', () => ({ useSpaceStore: mocks.space }));

describe('cap space isolation', () => {
  it('writes and reloads the currently selected space', async () => {
    const space = reactive({ currentSpaceId: 'first' });
    mocks.space.mockReturnValue(space);
    mocks.get.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue(undefined);
    const scope = effectScope();
    try {
      const cap = scope.run(() => useCap())!;
      await flushPromises();
      space.currentSpaceId = 'second';
      await flushPromises();
      await cap.setCap({ monthlyCapMinor: 5000, nudgeEnabled: false, nudgePct: 80 });
      expect(mocks.upsert).toHaveBeenCalledWith(
        {},
        { space_id: 'second', monthly_cap_minor: 5000, nudge_enabled: false, nudge_pct: 80 }
      );
      expect(mocks.get).toHaveBeenLastCalledWith({}, 'second');
    } finally {
      scope.stop();
    }
  });
});
