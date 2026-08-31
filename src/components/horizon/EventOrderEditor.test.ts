import { mount } from '@vue/test-utils';
import type { EventOrder } from '@roman-mik/kapa-core/horizon/queries';
import { describe, expect, it } from 'vite-plus/test';
import EventOrderEditor from './EventOrderEditor.vue';

const DEFAULT_ORDER: EventOrder = 'income,oneOffIn,obligation,plannedSpend,oneOffOut';

function mountEditor(order: EventOrder = DEFAULT_ORDER) {
  return mount(EventOrderEditor, { props: { modelValue: order } });
}

describe('EventOrderEditor', () => {
  it('renders all five kinds in their stored order', () => {
    const wrapper = mountEditor();
    const labels = wrapper.findAll('.row .label').map((n) => n.text());
    expect(labels).toEqual(['Income', 'One-off in', 'Obligations', 'Planned spend', 'One-off out']);
  });

  it('emits the reordered string when moving an item earlier', async () => {
    const wrapper = mountEditor();
    // Move the item at index 1 (One-off in) earlier.
    const moveEarlier = wrapper.findAll('.controls button')[1];
    await moveEarlier.trigger('click');
    expect(wrapper.emitted('update:modelValue')![0][0]).toBe(
      'oneOffIn,income,obligation,plannedSpend,oneOffOut'
    );
  });

  it('emits the reordered string when moving an item later', async () => {
    const wrapper = mountEditor();
    // Move the item at index 0 (Income) later.
    const moveLater = wrapper.findAll('.controls button')[1];
    await moveLater.trigger('click');
    expect(wrapper.emitted('update:modelValue')![0][0]).toBe(
      'oneOffIn,income,obligation,plannedSpend,oneOffOut'
    );
  });

  it('disables the first item from moving earlier and the last from moving later', () => {
    const wrapper = mountEditor();
    const buttons = wrapper.findAll('.controls button');
    expect(buttons[0].attributes('disabled')).toBeDefined();
    expect(buttons[buttons.length - 1].attributes('disabled')).toBeDefined();
  });

  it('keeps all five kinds present after reordering', async () => {
    const wrapper = mountEditor();
    const moveEarlier = wrapper.findAll('.controls button')[1];
    await moveEarlier.trigger('click');
    const order = String(wrapper.emitted('update:modelValue')![0][0]).split(',');
    expect(order.sort()).toEqual(
      ['income', 'oneOffIn', 'obligation', 'plannedSpend', 'oneOffOut'].sort()
    );
  });
});
