import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vite-plus/test';
import { horizonProjection } from '@/lib/landing/horizonDemo';
import MoneyLine from './MoneyLine.vue';

const projection = horizonProjection(new Date(Date.UTC(2026, 0, 1)));

describe('MoneyLine', () => {
  it('starts in the month-end view and switches to daily by click', async () => {
    vi.useFakeTimers();
    const wrapper = mount(MoneyLine, { props: { projection } });

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Month end');

    await wrapper.findAll('[role="radio"]')[1]!.trigger('click');

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Every day');
    vi.useRealTimers();
  });

  it('auto-reveals the daily view once, then stops', async () => {
    vi.useFakeTimers();
    const wrapper = mount(MoneyLine, { props: { projection } });

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Month end');
    await vi.advanceTimersByTimeAsync(950);

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Every day');
    vi.useRealTimers();
  });

  it('toggles with arrow keys on the radiogroup', async () => {
    vi.useFakeTimers();
    const wrapper = mount(MoneyLine, { props: { projection } });

    await wrapper.get('[role="radiogroup"]').trigger('keydown', { key: 'ArrowRight' });

    expect(wrapper.get('[role="radio"][aria-checked="true"]').text()).toBe('Every day');
    vi.useRealTimers();
  });
});
