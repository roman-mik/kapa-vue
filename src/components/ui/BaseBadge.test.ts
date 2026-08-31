import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import BaseBadge from './BaseBadge.vue';

describe('BaseBadge', () => {
  it('renders its slot text', () => {
    const wrapper = mount(BaseBadge, { slots: { default: 'Confirmed' } });
    expect(wrapper.text()).toBe('Confirmed');
  });

  it('defaults to the neutral variant', () => {
    const wrapper = mount(BaseBadge, { slots: { default: 'Recurring' } });
    expect(wrapper.classes()).toContain('badge');
    expect(wrapper.classes()).toContain('badge-neutral');
  });

  it('applies each variant class', () => {
    const variants = ['confirmed', 'expected', 'uncertain', 'in', 'out'] as const;
    for (const variant of variants) {
      const wrapper = mount(BaseBadge, {
        props: { variant },
        slots: { default: 'x' },
      });
      expect(wrapper.classes()).toContain(`badge-${variant}`);
    }
  });
});
