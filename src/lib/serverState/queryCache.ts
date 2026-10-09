import { computed, ref, shallowReactive, type ComputedRef, type Ref } from 'vue';

export type QueryKey = readonly unknown[];

export interface QueryOptions<T> {
  key: QueryKey;
  staleTimeMs: number;
  load: () => Promise<T>;
}

export interface QueryHandle<T> {
  data: Ref<T | undefined>;
  error: Ref<string | null>;
  loading: ComputedRef<boolean>;
  fetch: () => Promise<T | undefined>;
  refresh: () => Promise<T | undefined>;
  invalidate: () => Promise<T | undefined>;
  setData: (update: (data: T | undefined) => T) => void;
}

interface QueryEntry<T> {
  key: QueryKey;
  data: Ref<T | undefined>;
  error: Ref<string | null>;
  pending: Map<number, Promise<T | undefined>>;
  staleTimeMs: number;
  load: () => Promise<T>;
  fetchedAt: number;
  generation: number;
  invalidated: boolean;
}

function serialiseKey(key: QueryKey): string {
  return JSON.stringify(key);
}

function errorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string' &&
    error.message.trim()
  )
    return error.message;
  return 'Could not load data.';
}

function keyStartsWith(key: QueryKey, prefix: QueryKey): boolean {
  return prefix.every((part, index) => Object.is(key[index], part));
}

/**
 * A small cache for remote data. It is intentionally framework-local rather
 * than a Pinia store: entries are non-persistent, scoped by their key, and
 * contain no view or form state.
 */
export class QueryCache {
  private readonly entries = new Map<string, QueryEntry<unknown>>();

  use<T>(options: QueryOptions<T>): QueryHandle<T> {
    const entry = this.entryFor(options);
    const loading = computed(() => entry.pending.size > 0);

    return {
      data: entry.data,
      error: entry.error,
      loading,
      fetch: () => this.fetch(entry, false),
      refresh: () => this.fetch(entry, true),
      invalidate: () => this.invalidate(options.key),
      setData: (update) => {
        entry.generation += 1;
        entry.data.value = update(entry.data.value);
        entry.error.value = null;
        entry.fetchedAt = Date.now();
        entry.invalidated = false;
      },
    };
  }

  async invalidate(prefix: QueryKey): Promise<undefined> {
    const refreshes: Promise<unknown>[] = [];
    for (const entry of this.entries.values()) {
      if (!keyStartsWith(entry.key, prefix)) continue;
      entry.invalidated = true;
      entry.generation += 1;
      refreshes.push(this.fetch(entry, true));
    }
    await Promise.all(refreshes);
    return undefined;
  }

  errors(prefix: QueryKey): string[] {
    return [...this.entries.values()]
      .filter((e) => keyStartsWith(e.key, prefix))
      .flatMap((e) => (e.error.value ? [e.error.value] : []));
  }

  clear(): void {
    for (const entry of this.entries.values()) {
      entry.generation += 1;
      entry.data.value = undefined;
      entry.error.value = null;
      entry.pending.clear();
    }
    this.entries.clear();
  }

  private entryFor<T>(options: QueryOptions<T>): QueryEntry<T> {
    const id = serialiseKey(options.key);
    const existing = this.entries.get(id) as QueryEntry<T> | undefined;
    if (existing) {
      existing.staleTimeMs = options.staleTimeMs;
      existing.load = options.load;
      return existing;
    }

    const entry: QueryEntry<T> = {
      key: options.key,
      data: ref<T>(),
      error: ref<string | null>(null),
      pending: shallowReactive(new Map()),
      staleTimeMs: options.staleTimeMs,
      load: options.load,
      fetchedAt: 0,
      generation: 0,
      invalidated: true,
    };
    this.entries.set(id, entry as QueryEntry<unknown>);
    return entry;
  }

  private fetch<T>(entry: QueryEntry<T>, force: boolean): Promise<T | undefined> {
    const current = entry.pending.get(entry.generation);
    if (current) return current;

    const isFresh =
      !entry.invalidated &&
      entry.data.value !== undefined &&
      Date.now() - entry.fetchedAt < entry.staleTimeMs;
    if (!force && isFresh) return Promise.resolve(entry.data.value);

    const generation = entry.generation;
    const request = entry
      .load()
      .then((data) => {
        if (entry.generation === generation) {
          entry.data.value = data;
          entry.error.value = null;
          entry.fetchedAt = Date.now();
          entry.invalidated = false;
        }
        return entry.data.value;
      })
      .catch((error: unknown) => {
        if (entry.generation === generation) entry.error.value = errorMessage(error);
        return entry.data.value;
      })
      .finally(() => {
        entry.pending.delete(generation);
      });
    entry.pending.set(generation, request);
    return request;
  }
}

export const queryCache = new QueryCache();
