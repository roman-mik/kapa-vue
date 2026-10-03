import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { queryCache } from '@/lib/serverState/queryCache';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { useSpaceQuery } from './useSpaceQuery';

function flush(): Promise<void> {
  return Promise.resolve().then(() => Promise.resolve());
}

describe('useSpaceQuery', () => {
  it('ignores an old-space completion after switching spaces', async () => {
    let resolveOld!: (value: string) => void;
    const old = new Promise<string>((resolve) => {
      resolveOld = resolve;
    });
    const query = useSpaceQuery({
      resource: 'race',
      staleTimeMs: 1_000,
      load: ({ spaceId }) => (spaceId === 's1' ? old : Promise.resolve('new')),
    });
    useSpaceStore().currentSpaceId = 's2';
    expect(query.data.value).toBeUndefined();
    await flush();
    resolveOld('old');
    await flush();
    expect(query.data.value).toBe('new');
    useSessionStore().user = null;
    expect(query.data.value).toBeUndefined();
  });

  it('invalidates dependents in the captured space only', async () => {
    const first = vi.fn().mockResolvedValue('first');
    const projection = useSpaceQuery({ resource: 'projection', staleTimeMs: 60_000, load: first });
    const accounts = useSpaceQuery({
      resource: 'accounts',
      staleTimeMs: 60_000,
      load: async () => [],
    });
    await flush();
    const invalidateOldSpace = accounts.invalidate;
    useSpaceStore().currentSpaceId = 's2';
    await flush();
    const count = first.mock.calls.length;
    await invalidateOldSpace();
    expect(first).toHaveBeenCalledTimes(count + 1);
    expect(first.mock.calls.at(-1)?.[0].spaceId).toBe('s1');
    expect(projection.data.value).toBe('first');
  });
  beforeEach(() => {
    setActivePinia(createPinia());
    queryCache.clear();
    const session = useSessionStore();
    session.user = { id: 'u1' } as never;
    const space = useSpaceStore();
    space.currentSpaceId = 's1';
  });

  it('does not load until both user and space are available', async () => {
    useSessionStore().user = null;
    useSpaceStore().currentSpaceId = null;
    const load = vi.fn();
    const query = useSpaceQuery({ resource: 'accounts', staleTimeMs: 1_000, load });
    await flush();

    expect(load).not.toHaveBeenCalled();
    expect(query.data.value).toBeUndefined();
  });

  it('changes entries when the active space changes', async () => {
    const load = vi.fn(async ({ spaceId }: { spaceId: string }) => [spaceId]);
    const query = useSpaceQuery({ resource: 'accounts', staleTimeMs: 1_000, load });
    await flush();
    useSpaceStore().currentSpaceId = 's2';
    await flush();

    expect(load).toHaveBeenNthCalledWith(1, { userId: 'u1', spaceId: 's1', params: [] });
    expect(load).toHaveBeenNthCalledWith(2, { userId: 'u1', spaceId: 's2', params: [] });
    expect(query.data.value).toEqual(['s2']);
  });
});
