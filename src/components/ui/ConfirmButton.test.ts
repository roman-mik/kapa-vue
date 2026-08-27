import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import ConfirmButton from './ConfirmButton.vue';

describe('ConfirmButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not emit confirm on the first click — it arms instead', async () => {
    const wrapper = mount(ConfirmButton, { props: { label: 'Delete' } });
    await wrapper.trigger('click');

    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.text()).toBe('Confirm?');
  });

  it('emits confirm on a second click within the armed window', async () => {
    const wrapper = mount(ConfirmButton, { props: { label: 'Delete' } });
    await wrapper.trigger('click');
    await wrapper.trigger('click');

    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.text()).toBe('Delete');
  });

  it('disarms after the window elapses, requiring a fresh confirm', async () => {
    const wrapper = mount(ConfirmButton, { props: { label: 'Delete', armedMs: 1000 } });
    await wrapper.trigger('click');
    vi.advanceTimersByTime(1001);
    await wrapper.trigger('click');

    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.text()).toBe('Confirm?');
  });

  it('disarms on blur', async () => {
    const wrapper = mount(ConfirmButton, { props: { label: 'Delete' } });
    await wrapper.trigger('click');
    await wrapper.trigger('blur');

    expect(wrapper.text()).toBe('Delete');
  });

  it('ignores clicks while disabled', async () => {
    const wrapper = mount(ConfirmButton, { props: { label: 'Delete', disabled: true } });
    await wrapper.trigger('click');

    expect(wrapper.text()).toBe('Delete');
  });

  it('uses a custom confirmLabel when provided', async () => {
    const wrapper = mount(ConfirmButton, {
      props: { label: 'Archive', confirmLabel: 'Really archive?' },
    });
    await wrapper.trigger('click');

    expect(wrapper.text()).toBe('Really archive?');
  });
});
