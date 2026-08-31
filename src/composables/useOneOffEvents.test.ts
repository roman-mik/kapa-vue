import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useOneOffEvents } from './useOneOffEvents';

const { listOneOffEvents, createOneOffEvent, updateOneOffEvent, deleteOneOffEvent } = vi.hoisted(
  () => ({
    listOneOffEvents: vi.fn(),
    createOneOffEvent: vi.fn(),
    updateOneOffEvent: vi.fn(),
    deleteOneOffEvent: vi.fn(),
  })
);

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    listOneOffEvents,
    createOneOffEvent,
    updateOneOffEvent,
    deleteOneOffEvent,
  };
});

function flush(): Promise<void> {
  // Fake timers freeze real setTimeout, so drain the microtask queue instead.
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

function oneOffRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    account_id: 'a1',
    amount_minor: 10000,
    category: 'gift',
    created_at: '2026-09-01T00:00:00Z',
    currency: 'RSD',
    date: '2026-09-12',
    direction: 'in',
    id: 'e1',
    name: 'Birthday gift',
    space_id: 'sp1',
    ...overrides,
  };
}

describe('useOneOffEvents', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    // Sep 2026 seen from Belgrade.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T00:00:00Z'));
    const space = useSpaceStore();
    space.spaces = [
      {
        id: 'sp1',
        name: 'Home',
        currency: 'RSD',
        timezone: 'Europe/Belgrade',
        created_at: '2026-01-01T00:00:00Z',
      },
    ];
    space.currentSpaceId = 'sp1';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fetches one-off events for the space and scopes the list to the current month', async () => {
    listOneOffEvents.mockResolvedValue([
      oneOffRow(),
      oneOffRow({ id: 'e2', date: '2026-10-01', name: 'Out of month' }),
    ]);
    const { monthOneOffs, month, convertibles } = useOneOffEvents();
    await flush();

    expect(listOneOffEvents).toHaveBeenCalledWith(expect.anything(), 'sp1');
    expect(month.value).toBe('2026-09');
    expect(monthOneOffs.value).toHaveLength(1);
    expect(monthOneOffs.value[0].id).toBe('e1');
    expect(convertibles.value).toEqual([
      { id: 'e1', currency: 'RSD', amountMinor: 10000, asOfDate: '2026-09-12' },
    ]);
  });

  it('add() creates the one-off event and refreshes', async () => {
    listOneOffEvents.mockResolvedValue([]);
    createOneOffEvent.mockResolvedValue({ id: 'e9' });
    const { add, monthOneOffs } = useOneOffEvents();
    await flush();

    await add({
      name: 'Refund',
      category: 'other',
      currency: 'RSD',
      accountId: 'a1',
      date: '2026-09-20',
      amountMinor: 5000,
      direction: 'in',
    });

    expect(createOneOffEvent).toHaveBeenCalledWith(expect.anything(), {
      space_id: 'sp1',
      account_id: 'a1',
      currency: 'RSD',
      name: 'Refund',
      category: 'other',
      amount_minor: 5000,
      date: '2026-09-20',
      direction: 'in',
    });
    expect(monthOneOffs.value).toEqual([]);
  });

  it('update() patches the event in place and refreshes', async () => {
    listOneOffEvents.mockResolvedValue([oneOffRow()]);
    updateOneOffEvent.mockResolvedValue(undefined);
    const { update, monthOneOffs } = useOneOffEvents();
    await flush();

    await update({
      id: 'e1',
      name: 'Birthday gift',
      category: 'gift',
      currency: 'RSD',
      accountId: 'a1',
      date: '2026-09-30',
      amountMinor: 15000,
      direction: 'in',
    });

    expect(updateOneOffEvent).toHaveBeenCalledWith(expect.anything(), 'e1', {
      name: 'Birthday gift',
      category: 'gift',
      currency: 'RSD',
      account_id: 'a1',
      amount_minor: 15000,
      date: '2026-09-30',
      direction: 'in',
    });
    expect(monthOneOffs.value).toHaveLength(1);
  });

  it('remove() hard-deletes the event and refreshes', async () => {
    listOneOffEvents.mockResolvedValueOnce([oneOffRow()]).mockResolvedValueOnce([]);
    deleteOneOffEvent.mockResolvedValue(undefined);
    const { remove, monthOneOffs } = useOneOffEvents();
    await flush();
    expect(monthOneOffs.value).toHaveLength(1);

    await remove('e1');

    expect(deleteOneOffEvent).toHaveBeenCalledWith(expect.anything(), 'e1');
    expect(monthOneOffs.value).toHaveLength(0);
  });
});
