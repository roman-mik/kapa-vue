import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vite-plus/test';
import ExpenseRowMenu from './ExpenseRowMenu.vue';
import type { RowMenuAction } from './expenseRowMenu';

const actions: RowMenuAction[] = [
  { id: 'edit', label: 'Edit', kind: 'action' },
  { id: 'duplicate', label: 'Duplicate', kind: 'action', disabled: true },
  { id: 'delete', label: 'Delete', kind: 'confirm', confirmLabel: 'Really delete?' },
];

describe('ExpenseRowMenu', () => {
  it('opens the menu on trigger click and closes it again', async () => {
    const wrapper = mount(ExpenseRowMenu, { props: { actions }, attachTo: document.body });
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);

    await wrapper.find('.row-menu-trigger').trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(true);

    await wrapper.find('.row-menu-trigger').trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('emits select and closes when an action item is clicked', async () => {
    const wrapper = mount(ExpenseRowMenu, { props: { actions }, attachTo: document.body });
    await wrapper.find('.row-menu-trigger').trigger('click');

    const items = wrapper.findAll('[role="menuitem"]');
    await items[0]!.trigger('click');

    expect(wrapper.emitted('select')).toEqual([['edit']]);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not emit select for a disabled action', async () => {
    const wrapper = mount(ExpenseRowMenu, { props: { actions }, attachTo: document.body });
    await wrapper.find('.row-menu-trigger').trigger('click');

    const items = wrapper.findAll('[role="menuitem"]');
    await items[1]!.trigger('click');

    expect(wrapper.emitted('select')).toBeUndefined();
    wrapper.unmount();
  });

  it('requires two clicks on a confirm action before emitting confirm', async () => {
    vi.useFakeTimers();
    const wrapper = mount(ExpenseRowMenu, { props: { actions }, attachTo: document.body });
    await wrapper.find('.row-menu-trigger').trigger('click');

    const deleteItem = wrapper.findAll('[role="menuitem"]')[2]!;
    await deleteItem.trigger('click');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.find('[role="menu"]').exists()).toBe(true);

    await deleteItem.trigger('click');

    expect(wrapper.emitted('confirm')).toEqual([['delete']]);
    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
    vi.useRealTimers();
  });

  it('closes the menu on an outside click', async () => {
    const wrapper = mount(ExpenseRowMenu, { props: { actions }, attachTo: document.body });
    await wrapper.find('.row-menu-trigger').trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(true);

    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('closes the menu on Escape', async () => {
    const wrapper = mount(ExpenseRowMenu, { props: { actions }, attachTo: document.body });
    await wrapper.find('.row-menu-trigger').trigger('click');
    expect(wrapper.find('[role="menu"]').exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[role="menu"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
