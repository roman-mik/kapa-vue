import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { useInvite } from './useInvite';

const { mintInvite } = vi.hoisted(() => ({
  mintInvite: vi.fn(),
}));

vi.mock('@roman-mik/kapa-core/core', () => ({
  mintInvite,
}));

const LIVE_INVITE = {
  code: 'ABCDEFGHJ1',
  created_at: '2026-08-29T00:00:00.000Z',
  created_by: 'u1',
  expires_at: '2026-08-30T00:00:00.000Z',
  redeemed_at: null,
  space_id: 's1',
};

describe('useInvite', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    const space = useSpaceStore();
    space.currentSpaceId = 's1';
    const session = useSessionStore();
    session.user = { id: 'u1' } as never;
  });

  it('does not mint when there is no current space', async () => {
    const space = useSpaceStore();
    space.currentSpaceId = null;
    mintInvite.mockClear();
    const { invite, mint } = useInvite();
    await mint();
    expect(mintInvite).not.toHaveBeenCalled();
    expect(invite.value).toBeNull();
  });

  it('mints for the current space and user on success', async () => {
    mintInvite.mockResolvedValue(LIVE_INVITE);
    const { invite, mint } = useInvite();
    await mint();
    expect(mintInvite).toHaveBeenCalledWith(expect.anything(), 's1', 'u1');
    expect(invite.value).toEqual(LIVE_INVITE);
  });

  it('sets an error message instead of throwing when minting fails', async () => {
    mintInvite.mockRejectedValueOnce(new Error('network down'));
    const { invite, error, mint } = useInvite();
    await mint();
    expect(error.value).toBe('network down');
    expect(invite.value).toBeNull();
  });

  it('reuses an existing live invite code on a second mint', async () => {
    mintInvite.mockResolvedValue(LIVE_INVITE);
    const { invite, mint } = useInvite();
    await mint();
    await mint();
    expect(mintInvite).toHaveBeenCalledTimes(2);
    expect(invite.value?.code).toBe(LIVE_INVITE.code);
  });
});
