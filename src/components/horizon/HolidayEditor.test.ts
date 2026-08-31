import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useSpaceStore } from '@/stores/space';
import HolidayEditor from './HolidayEditor.vue';

function fakeHoliday(overrides: Record<string, unknown> = {}) {
  return {
    id: 'h1',
    space_id: 'sp1',
    date: '2026-09-01',
    name: "New Year's Day",
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

async function mountEditor({ add = vi.fn(), remove = vi.fn() } = {}) {
  const wrapper = mount(HolidayEditor, {
    props: { holidays: [fakeHoliday()], add, remove },
  });
  await flushPromises();
  return { wrapper, add, remove };
}

describe('HolidayEditor', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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

  it('renders the existing holidays with a remove button', async () => {
    const { wrapper } = await mountEditor();
    expect(wrapper.text()).toContain("New Year's Day");
    expect(wrapper.text()).toContain('2026-09-01');
  });

  it('emits remove for a holiday when its Remove button is clicked', async () => {
    const { wrapper, remove } = await mountEditor();
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Remove')!
      .trigger('click');
    await flushPromises();
    expect(remove).toHaveBeenCalledWith('h1');
  });

  it('calls add with the date and name on submit and clears the name on success', async () => {
    const add = vi.fn().mockResolvedValue({ ok: true });
    const { wrapper } = await mountEditor({ add });
    await wrapper.find('input[type="date"]').setValue('2026-09-15');
    await wrapper.find('input[type="text"]').setValue('Statehood Day');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(add).toHaveBeenCalledWith('2026-09-15', 'Statehood Day');
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('');
  });

  it('surfaces the duplicate-date message and keeps the name on a duplicate', async () => {
    const add = vi.fn().mockResolvedValue({ ok: false, reason: 'duplicate' });
    const { wrapper } = await mountEditor({ add });
    await wrapper.find('input[type="date"]').setValue('2026-09-15');
    await wrapper.find('input[type="text"]').setValue('Statehood Day');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.find('[role="alert"]').text()).toContain('already has a holiday');
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe(
      'Statehood Day'
    );
  });

  it('rejects a blank name before calling add', async () => {
    const add = vi.fn();
    const { wrapper } = await mountEditor({ add });
    await wrapper.find('input[type="date"]').setValue('2026-09-15');
    await wrapper.find('input[type="text"]').setValue('');
    await wrapper.find('form').trigger('submit');

    expect(add).not.toHaveBeenCalled();
    expect(wrapper.find('[role="alert"]').text()).toContain('Enter a name.');
  });
});
