import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { nextTick } from 'vue';
import type { Category } from '@roman-mik/kapa-core/core';
import CategoryFilterPicker from './CategoryFilterPicker.vue';

const categories = [
  { id: 'b', name: 'Zoo', archived: false },
  { id: 'a', name: 'Groceries', archived: true },
  { id: 'c', name: 'Продукты', archived: false },
] as Category[];
let change: (event: MediaQueryListEvent) => void;
let wrapper: ReturnType<typeof mount>;
function setup(desktop = true, modelValue = 'all') {
  vi.stubGlobal('matchMedia', () => ({
    matches: desktop,
    addEventListener: (_: string, listener: typeof change) => {
      change = listener;
    },
    removeEventListener: vi.fn(),
  }));
  wrapper = mount(CategoryFilterPicker, {
    attachTo: document.body,
    props: { categories, modelValue, spaceId: 'one' },
  });
  return wrapper;
}
function options() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.category-options button'));
}
async function open() {
  await wrapper.get('.category-trigger').trigger('click');
  await nextTick();
}
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
});
beforeEach(() => {
  change = () => {};
});

describe('CategoryFilterPicker', () => {
  it.each([true, false])(
    'opens searchable picker (desktop=%s), selects archived IDs and restores focus',
    async (desktop) => {
      setup(desktop);
      await open();
      expect(document.querySelector('.category-popover') !== null).toBe(desktop);
      expect(document.querySelector('.sheet-panel') !== null).toBe(!desktop);
      expect(options().map((b) => b.querySelector('.option-name')?.textContent?.trim())).toEqual([
        'All categories',
        'Uncategorized',
        'GroceriesArchived',
        'Zoo',
        'Продукты',
      ]);
      expect(document.activeElement?.tagName).toBe('INPUT');
      options()[2]!.click();
      await nextTick();
      await nextTick();
      expect(wrapper.emitted('update:modelValue')).toEqual([['a']]);
      expect(document.activeElement).toBe(wrapper.get('.category-trigger').element);
    }
  );
  it('searches Cyrillic without case sensitivity and keeps All for no matches', async () => {
    setup();
    await open();
    await wrapper.get('input').setValue('ПРОД');
    expect(options().map((b) => b.querySelector('.option-name')?.textContent?.trim())).toEqual([
      'All categories',
      'Продукты',
    ]);
    await wrapper.get('input').setValue('missing');
    expect(options()).toHaveLength(1);
    expect(wrapper.text()).toContain('No matching categories');
    options()[0]!.click();
    await nextTick();
    expect(wrapper.emitted('update:modelValue')).toEqual([['all']]);
  });
  it('dismisses without selection and reopens with current selection and empty search', async () => {
    setup(true, 'b');
    await open();
    await wrapper.get('input').setValue('Zoo');
    await wrapper.get('input').trigger('keydown', { key: 'Escape' });
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    await open();
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe('');
    expect(options().find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent).toContain(
      'Zoo'
    );
  });
  it('supports arrows, Home/End and native button activation', async () => {
    setup();
    await open();
    await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options()[0]);
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true })
    );
    expect(document.activeElement).toBe(options().at(-1));
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Home', bubbles: true })
    );
    expect(document.activeElement).toBe(options()[0]);
    options()[0]!.click();
    await nextTick();
    expect(wrapper.emitted('update:modelValue')).toEqual([['all']]);
  });
  it('closes on space changes, breakpoint changes and outside clicks', async () => {
    setup();
    await open();
    await wrapper.setProps({ spaceId: 'two' });
    expect(wrapper.find('.category-popover').exists()).toBe(false);
    await open();
    change({ matches: false } as MediaQueryListEvent);
    await nextTick();
    expect(document.querySelector('.sheet-panel')).toBeNull();
    change({ matches: true } as MediaQueryListEvent);
    await nextTick();
    await open();
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();
    expect(wrapper.find('.category-popover').exists()).toBe(false);
  });
  it.each([0, 15, 55])('renders one closed trigger with %s categories', async (count) => {
    setup();
    await wrapper.setProps({
      categories: Array.from({ length: count }, (_, i) => ({
        ...categories[0],
        id: `${i}`,
        name: 'Long category name '.repeat(5),
      })) as Category[],
    });
    expect(wrapper.findAll('button')).toHaveLength(1);
    expect(wrapper.find('.category-options').exists()).toBe(false);
  });
});
