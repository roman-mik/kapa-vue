import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import PocketDemo from './PocketDemo.vue';

describe('PocketDemo', () => {
  it('moves the spent figure when a category chip is tapped', async () => {
    const wrapper = mount(PocketDemo);
    const before = wrapper.get('.spent').text();

    await wrapper.get('.chip').trigger('click');

    expect(wrapper.get('.spent').text()).not.toBe(before);
  });

  it('flips to the over-cap line once taps push spend past the fixture cap', async () => {
    const wrapper = mount(PocketDemo);
    // The fixture cap is 60,000 minor units and starting spend is 31,400 —
    // three taps of "Household" (12,000 each) clears it.
    for (let i = 0; i < 3; i += 1) {
      await wrapper.findAll('.chip')[4]!.trigger('click');
    }

    expect(wrapper.find('.line.over').exists()).toBe(true);
  });

  it('reset returns to the fixture starting point', async () => {
    const wrapper = mount(PocketDemo);
    const before = wrapper.get('.spent').text();
    await wrapper.get('.chip').trigger('click');
    expect(wrapper.find('.reset').exists()).toBe(true);

    await wrapper.get('.reset').trigger('click');

    expect(wrapper.get('.spent').text()).toBe(before);
    expect(wrapper.find('.reset').exists()).toBe(false);
  });
});
