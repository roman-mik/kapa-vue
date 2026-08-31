import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import { useSpaceStore } from '@/stores/space';
import { useReconcile } from './useReconcile';

const { reconcileBalances, createOneOffEvent } = vi.hoisted(() => ({
  reconcileBalances: vi.fn(),
  createOneOffEvent: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/horizon', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon')>();
  return {
    ...actual,
    reconcileBalances,
  };
});

vi.mock('@roman-mik/kapa-core/horizon/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@roman-mik/kapa-core/horizon/queries')>();
  return {
    ...actual,
    createOneOffEvent,
  };
});

const ACCOUNT_A: Account = {
  id: 'acc1',
  space_id: 'sp1',
  name: 'Checking',
  currency: 'EUR',
  current_balance_minor: 100000,
  type: 'bank',
  include_in_total: true,
  sort_order: 1,
  archived: false,
  updated_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
};

function flush(): Promise<void> {
  return Promise.resolve()
    .then(() => Promise.resolve())
    .then(() => Promise.resolve());
}

describe('useReconcile', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
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

  it('pre-fills drafts with each account current balance and derives variance', () => {
    const { draftFor, varianceFor } = useReconcile(() => [ACCOUNT_A], vi.fn());

    // Default draft equals the projected balance, so variance is zero.
    expect(draftFor(ACCOUNT_A).actual).toBe('1000');
    expect(varianceFor(ACCOUNT_A)).toBe(0);

    // Editing the actual upward yields a positive variance.
    draftFor(ACCOUNT_A).actual = '1050.00';
    expect(varianceFor(ACCOUNT_A)).toBe(5000);
  });

  it('filters archived accounts out of the reconcile list', () => {
    const archived = { ...ACCOUNT_A, id: 'acc2', archived: true };
    const { activeAccounts } = useReconcile(() => [ACCOUNT_A, archived], vi.fn());
    expect(activeAccounts().map((a) => a.id)).toEqual(['acc1']);
  });

  it('saves an entry per active account and calls onSaved', async () => {
    reconcileBalances.mockResolvedValue(undefined);

    const onSaved = vi.fn();
    const { draftFor, save } = useReconcile(() => [ACCOUNT_A], onSaved);
    draftFor(ACCOUNT_A).note = 'Drift';
    draftFor(ACCOUNT_A).actual = '1100';

    const ok = await save();

    expect(ok).toBe(true);
    expect(reconcileBalances).toHaveBeenCalledWith(expect.anything(), 'sp1', [
      { accountId: 'acc1', balanceMinor: 110000, note: 'Drift' },
    ]);
    expect(onSaved).toHaveBeenCalled();
  });

  it('surfaces a reconcile failure', async () => {
    reconcileBalances.mockRejectedValue(new Error('network'));

    const { save, saveError } = useReconcile(() => [ACCOUNT_A], vi.fn());
    const ok = await save();

    expect(ok).toBe(false);
    expect(saveError.value).toBe('network');
  });

  it('logs a non-zero variance as a one-off event with the right direction', async () => {
    // Positive variance: model under-counted -> an 'in' windfall.
    const { draftFor, logAsOneOff } = useReconcile(() => [ACCOUNT_A], vi.fn());
    draftFor(ACCOUNT_A).actual = '1050';

    const ok = await logAsOneOff(ACCOUNT_A);

    expect(ok).toBe(true);
    expect(createOneOffEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        space_id: 'sp1',
        account_id: 'acc1',
        currency: 'EUR',
        direction: 'in',
        amount_minor: 5000,
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      })
    );
  });

  it('logs a negative variance as an out event', async () => {
    const { draftFor, logAsOneOff } = useReconcile(() => [ACCOUNT_A], vi.fn());
    draftFor(ACCOUNT_A).actual = '950';

    await logAsOneOff(ACCOUNT_A);

    expect(createOneOffEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ direction: 'out', amount_minor: 5000 })
    );
  });

  it('does nothing when the variance is zero', async () => {
    const { logAsOneOff } = useReconcile(() => [ACCOUNT_A], vi.fn());
    const ok = await logAsOneOff(ACCOUNT_A);

    expect(ok).toBe(false);
    expect(createOneOffEvent).not.toHaveBeenCalled();
  });

  it('clears drafts when the space changes', async () => {
    const { draftFor } = useReconcile(() => [ACCOUNT_A], vi.fn());
    draftFor(ACCOUNT_A).actual = '2000';

    const space = useSpaceStore();
    space.currentSpaceId = null;
    await flush();

    // A fresh draft re-initializes from the account balance.
    expect(draftFor(ACCOUNT_A).actual).toBe('1000');
  });
});
