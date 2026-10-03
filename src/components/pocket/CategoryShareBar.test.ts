import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import CategoryShareBar from './CategoryShareBar.vue';

describe('CategoryShareBar', () => {
  it('sizes the fill to the given percent and defaults to the accent colour', () => {
    const wrapper = mount(CategoryShareBar, { props: { percent: 39 } });
    const fill = wrapper.find('.share-bar-fill');
    expect(fill.attributes('style')).toContain('width: 39%');
    expect(fill.attributes('style')).toContain('var(--kapa-accent)');
  });

  it('uses a per-instance colour when given one', () => {
    const wrapper = mount(CategoryShareBar, {
      props: { percent: 62, color: 'var(--kapa-swatch-3)' },
    });
    const fill = wrapper.find('.share-bar-fill');
    expect(fill.attributes('style')).toContain('width: 62%');
    expect(fill.attributes('style')).toContain('var(--kapa-swatch-3)');
  });

  it('clamps display at 100% for an already-clamped input without erroring', () => {
    const wrapper = mount(CategoryShareBar, { props: { percent: 100 } });
    expect(wrapper.find('.share-bar-fill').attributes('style')).toContain('width: 100%');
  });
});
