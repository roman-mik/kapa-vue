import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import { useCategories } from './useCategories';

const { listCategories, addCategory, renameCategory, archiveCategory, restoreCategory } =
  vi.hoisted(() => ({
    listCategories: vi.fn(),
    addCategory: vi.fn(),
    renameCategory: vi.fn(),
    archiveCategory: vi.fn(),
    restoreCategory: vi.fn(),
  }));

vi.mock('@roman-mik/kapa-core/core', () => ({
  listCategories,
  addCategory,
  renameCategory,
  archiveCategory,
  restoreCategory,
}));

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useCategories', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    listCategories.mockResolvedValue([{ id: 'c1', name: 'Groceries' }]);
    const space = useSpaceStore();
    space.currentSpaceId = 's1';
  });

  it('has no categories and does not fetch when there is no current space', async () => {
    setActivePinia(createPinia());
    listCategories.mockClear();
    const { categories } = useCategories();
    await flush();
    expect(categories.value).toEqual([]);
    expect(listCategories).not.toHaveBeenCalled();
  });

  it('fetches categories for the current space on init', async () => {
    const { categories } = useCategories();
    await flush();
    expect(listCategories).toHaveBeenCalledWith(expect.anything(), 's1', {});
    expect(categories.value).toEqual([{ id: 'c1', name: 'Groceries' }]);
  });

  it('sets an error message instead of throwing when the fetch fails', async () => {
    listCategories.mockRejectedValueOnce(new Error('network down'));
    const { error, categories } = useCategories();
    await flush();
    expect(error.value).toBe('network down');
    expect(categories.value).toEqual([]);
  });

  it('add() calls through and refreshes the list', async () => {
    const { add, categories } = useCategories();
    await flush();
    addCategory.mockResolvedValue(undefined);
    listCategories.mockResolvedValue([
      { id: 'c1', name: 'Groceries' },
      { id: 'c2', name: 'Rent' },
    ]);

    await add('Rent');

    expect(addCategory).toHaveBeenCalledWith(expect.anything(), 's1', 'Rent', undefined);
    expect(categories.value).toHaveLength(2);
  });

  it('archive() and restore() call through by category id', async () => {
    const { archive, restore } = useCategories();
    await flush();

    await archive('c1');
    expect(archiveCategory).toHaveBeenCalledWith(expect.anything(), 'c1');

    await restore('c1');
    expect(restoreCategory).toHaveBeenCalledWith(expect.anything(), 'c1');
  });

  it('rename() calls through with the new name', async () => {
    const { rename } = useCategories();
    await flush();

    await rename('c1', 'Household');
    expect(renameCategory).toHaveBeenCalledWith(expect.anything(), 'c1', 'Household');
  });
});
