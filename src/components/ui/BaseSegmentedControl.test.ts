import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import BaseSegmentedControl from './BaseSegmentedControl.vue';

const options = [
  { value: 'cap', label: 'Cap' },
  { value: 'runRate', label: 'Run rate' },
];

describe('BaseSegmentedControl', () => {
  it('renders one segment per option', () => {
    const wrapper = mount(BaseSegmentedControl, { props: { options, modelValue: 'cap' } });
    const segments = wrapper.findAll('[role="radio"]');
    expect(segments).toHaveLength(2);
    expect(segments[0]?.text()).toBe('Cap');
    expect(segments[1]?.text()).toBe('Run rate');
  });

  it('marks the selected segment via aria-checked and roving tabindex', () => {
    const wrapper = mount(BaseSegmentedControl, { props: { options, modelValue: 'runRate' } });
    const segments = wrapper.findAll('[role="radio"]');
    expect(segments[0]?.attributes('aria-checked')).toBe('false');
    expect(segments[0]?.attributes('tabindex')).toBe('-1');
    expect(segments[1]?.attributes('aria-checked')).toBe('true');
    expect(segments[1]?.attributes('tabindex')).toBe('0');
  });

  it('emits update:modelValue on click', async () => {
    const wrapper = mount(BaseSegmentedControl, { props: { options, modelValue: 'cap' } });
    await wrapper.findAll('[role="radio"]')[1]?.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['runRate']);
  });

  it('moves selection right with ArrowRight, wrapping past the last option', async () => {
    const wrapper = mount(BaseSegmentedControl, { props: { options, modelValue: 'runRate' } });
    await wrapper.findAll('[role="radio"]')[1]?.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['cap']);
  });

  it('moves selection left with ArrowLeft, wrapping past the first option', async () => {
    const wrapper = mount(BaseSegmentedControl, { props: { options, modelValue: 'cap' } });
    await wrapper.findAll('[role="radio"]')[0]?.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['runRate']);
  });
});
