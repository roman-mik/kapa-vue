import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import WorkCalendarEditor from './WorkCalendarEditor.vue';

describe('WorkCalendarEditor', () => {
  it('renders all seven days', () => {
    const wrapper = mount(WorkCalendarEditor, { props: { modelValue: [1, 2, 3, 4, 5] } });
    expect(wrapper.findAll('.day-label')).toHaveLength(7);
  });

  it('checks the passed working weekdays', () => {
    const wrapper = mount(WorkCalendarEditor, { props: { modelValue: [1, 2, 3, 4, 5] } });
    const checked = wrapper
      .findAll('.day-label input')
      .filter((i) => (i.element as HTMLInputElement).checked);
    expect(checked).toHaveLength(5);
    // Mon–Fri checked; Sat (index 5) and Sun (index 6) unchecked.
    expect((wrapper.findAll('.day-label input')[5].element as HTMLInputElement).checked).toBe(
      false
    );
    expect((wrapper.findAll('.day-label input')[6].element as HTMLInputElement).checked).toBe(
      false
    );
  });

  it('emits the updated weekdays when a day is toggled on', async () => {
    const wrapper = mount(WorkCalendarEditor, { props: { modelValue: [1, 2, 3, 4, 5] } });
    const saturday = wrapper.findAll('.day-label input')[5];
    await saturday.setValue(true);
    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('emits the updated weekdays when a day is toggled off', async () => {
    const wrapper = mount(WorkCalendarEditor, { props: { modelValue: [1, 2, 3, 4, 5] } });
    const monday = wrapper.findAll('.day-label input')[0];
    await monday.setValue(false);
    expect(wrapper.emitted('update:modelValue')![0][0]).toEqual([2, 3, 4, 5]);
  });
});
