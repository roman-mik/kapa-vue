import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import BaseSheet from './BaseSheet.vue';

function mountSheet(props: { open: boolean; dismissible?: boolean } = { open: true }) {
  return mount(BaseSheet, {
    props,
    attachTo: document.body,
    slots: {
      default: '<button data-autofocus>Amount</button><button>Other</button>',
    },
  });
}

function backdrop(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('.sheet-backdrop');
  if (!el) throw new Error('sheet-backdrop not found in document.body');
  return el;
}

function panel(): HTMLElement {
  const el = document.body.querySelector<HTMLElement>('.sheet-panel');
  if (!el) throw new Error('sheet-panel not found in document.body');
  return el;
}

describe('BaseSheet', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('focuses the [data-autofocus] element when opened', async () => {
    const wrapper = mountSheet({ open: true });
    await nextTick();
    await nextTick();
    expect(document.activeElement?.getAttribute('data-autofocus')).toBe('');
    wrapper.unmount();
  });

  it('emits close on Escape', async () => {
    const wrapper = mountSheet({ open: true });
    await nextTick();
    backdrop().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('emits close on a backdrop click', async () => {
    const wrapper = mountSheet({ open: true });
    await nextTick();
    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toHaveLength(1);
    wrapper.unmount();
  });

  it('does not close when clicking inside the panel', async () => {
    const wrapper = mountSheet({ open: true });
    await nextTick();
    panel().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toBeUndefined();
    wrapper.unmount();
  });

  it('does not emit close when dismissible is false', async () => {
    const wrapper = mountSheet({ open: true, dismissible: false });
    await nextTick();
    backdrop().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    backdrop().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(wrapper.emitted('close')).toBeUndefined();
    wrapper.unmount();
  });

  it('renders nothing when closed', () => {
    const wrapper = mountSheet({ open: false });
    expect(document.body.querySelector('.sheet-backdrop')).toBeNull();
    wrapper.unmount();
  });
});
