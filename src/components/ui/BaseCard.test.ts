import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import BaseCard from './BaseCard.vue';

describe('BaseCard', () => {
  it('renders its slot content', () => {
    const wrapper = mount(BaseCard, { slots: { default: 'Row content' } });
    expect(wrapper.text()).toBe('Row content');
  });

  it('applies the card class', () => {
    const wrapper = mount(BaseCard, { slots: { default: 'x' } });
    expect(wrapper.classes()).toContain('card');
  });

  it('defaults to medium padding', () => {
    const wrapper = mount(BaseCard, { slots: { default: 'x' } });
    expect(wrapper.classes()).toContain('pad-md');
  });

  it('applies small padding when requested', () => {
    const wrapper = mount(BaseCard, { props: { padding: 'sm' }, slots: { default: 'x' } });
    expect(wrapper.classes()).toContain('pad-sm');
    expect(wrapper.classes()).not.toContain('pad-md');
  });
});
