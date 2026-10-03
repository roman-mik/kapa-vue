import { describe, expect, it, vi } from 'vite-plus/test';
import { QueryCache } from './queryCache';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('QueryCache', () => {
  it('updates loading while a request is pending and after it settles', async () => {
    const cache = new QueryCache();
    const response = deferred<number>();
    const query = cache.use({
      key: ['u1', 's1', 'accounts'],
      staleTimeMs: 1_000,
      load: () => response.promise,
    });
    expect(query.loading.value).toBe(false);
    const request = query.fetch();
    expect(query.loading.value).toBe(true);
    response.resolve(1);
    await request;
    expect(query.loading.value).toBe(false);
  });

  it('reuses fresh data and loads again after the stale time', async () => {
    const cache = new QueryCache();
    const clock = vi.spyOn(Date, 'now');
    clock.mockReturnValue(1_000);
    const load = vi.fn().mockResolvedValue(1);
    const query = cache.use({ key: ['u1', 's1', 'accounts'], staleTimeMs: 1_000, load });
    try {
      await query.fetch();
      clock.mockReturnValue(1_500);
      await query.fetch();
      expect(load).toHaveBeenCalledTimes(1);
      clock.mockReturnValue(2_001);
      await query.fetch();
      expect(load).toHaveBeenCalledTimes(2);
    } finally {
      clock.mockRestore();
    }
  });
  it('deduplicates concurrent loads for the same key', async () => {
    const cache = new QueryCache();
    const load = vi.fn().mockResolvedValue(['account']);
    const first = cache.use({ key: ['u1', 's1', 'accounts'], staleTimeMs: 1_000, load });
    const second = cache.use({ key: ['u1', 's1', 'accounts'], staleTimeMs: 1_000, load });

    await Promise.all([first.refresh(), second.refresh()]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(first.data.value).toEqual(['account']);
    expect(second.data.value).toEqual(['account']);
  });

  it('isolates entries with different keys', async () => {
    const cache = new QueryCache();
    const first = cache.use({
      key: ['u1', 's1', 'accounts'],
      staleTimeMs: 1_000,
      load: async () => 1,
    });
    const second = cache.use({
      key: ['u1', 's2', 'accounts'],
      staleTimeMs: 1_000,
      load: async () => 2,
    });

    await Promise.all([first.refresh(), second.refresh()]);

    expect(first.data.value).toBe(1);
    expect(second.data.value).toBe(2);
  });

  it('refetches every matching entry after invalidation', async () => {
    const cache = new QueryCache();
    const load = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const query = cache.use({ key: ['u1', 's1', 'accounts'], staleTimeMs: 60_000, load });

    await query.refresh();
    await cache.invalidate(['u1', 's1', 'accounts']);

    expect(load).toHaveBeenCalledTimes(2);
    expect(query.data.value).toBe(2);
  });

  it('discards a late response after invalidation starts a new generation', async () => {
    const cache = new QueryCache();
    const first = deferred<string>();
    const second = deferred<string>();
    const load = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const query = cache.use({ key: ['u1', 's1', 'accounts'], staleTimeMs: 1_000, load });

    const initial = query.refresh();
    const invalidation = cache.invalidate(['u1', 's1', 'accounts']);
    second.resolve('current');
    await invalidation;
    first.resolve('stale');
    await initial;

    expect(query.data.value).toBe('current');
  });

  it('clears entries so a subsequent consumer cannot receive prior data', async () => {
    const cache = new QueryCache();
    const first = cache.use({
      key: ['u1', 's1', 'accounts'],
      staleTimeMs: 1_000,
      load: async () => 1,
    });
    await first.refresh();
    cache.clear();
    const second = cache.use({
      key: ['u2', 's1', 'accounts'],
      staleTimeMs: 1_000,
      load: async () => 2,
    });
    await second.refresh();

    expect(second.data.value).toBe(2);
  });
});
