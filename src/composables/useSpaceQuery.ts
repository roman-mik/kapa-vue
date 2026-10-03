import { computed, shallowRef, watch, type ComputedRef } from 'vue';
import { queryCache, type QueryHandle, type QueryKey } from '@/lib/serverState/queryCache';
import { invalidateResources } from '@/lib/serverState/invalidation';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';

export interface SpaceQueryContext {
  userId: string;
  spaceId: string;
  params: readonly unknown[];
}

export interface SpaceQueryOptions<T> {
  resource: string;
  staleTimeMs: number;
  params?: () => readonly unknown[];
  load: (context: SpaceQueryContext) => Promise<T>;
}

export interface SpaceQuery<T> {
  data: ComputedRef<T | undefined>;
  error: ComputedRef<string | null>;
  loading: ComputedRef<boolean>;
  refresh: () => Promise<T | undefined>;
  invalidate: () => Promise<T | undefined>;
  setData: (update: (data: T | undefined) => T) => void;
}

function serialiseParams(params: readonly unknown[]): string {
  return JSON.stringify(params);
}

/**
 * Binds a remote resource to the active authenticated space. A key changes
 * before the new load begins, so responses from a former space remain in
 * their own cache entry and cannot leak into the currently rendered view.
 */
export function useSpaceQuery<T>(options: SpaceQueryOptions<T>): SpaceQuery<T> {
  const session = useSessionStore();
  const space = useSpaceStore();
  const handle = shallowRef<QueryHandle<T> | null>(null);
  const invalidate = shallowRef<() => Promise<void>>(async () => {});

  const params = computed(() => options.params?.() ?? []);

  watch(
    [
      () => session.user?.id ?? null,
      () => space.currentSpaceId,
      () => serialiseParams(params.value),
    ],
    ([userId, spaceId]) => {
      if (!userId || !spaceId) {
        handle.value = null;
        invalidate.value = async () => {};
        return;
      }

      const snapshot = [...params.value];
      const key: QueryKey = [userId, spaceId, options.resource, ...snapshot];
      const next = queryCache.use({
        key,
        staleTimeMs: options.staleTimeMs,
        load: () => options.load({ userId, spaceId, params: snapshot }),
      });
      handle.value = next;
      invalidate.value = () => invalidateResources(userId, spaceId, options.resource);
      void next.fetch();
    },
    { immediate: true, flush: 'sync' }
  );

  return {
    data: computed(() => handle.value?.data.value),
    error: computed(() => handle.value?.error.value ?? null),
    loading: computed(() => handle.value?.loading.value ?? false),
    refresh: () => handle.value?.refresh() ?? Promise.resolve(undefined),
    get invalidate() {
      const captured = invalidate.value;
      return async () => {
        await captured();
        return undefined;
      };
    },
    setData: (update) => handle.value?.setData(update),
  };
}
