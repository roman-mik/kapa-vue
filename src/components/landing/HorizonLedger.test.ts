import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import { horizonProjection } from '@/lib/landing/horizonDemo';
import HorizonLedger from './HorizonLedger.vue';

const projection = horizonProjection(new Date(Date.UTC(2026, 0, 1)));

describe('HorizonLedger', () => {
  it("renders only the requested month's events", () => {
    const wrapper = mount(HorizonLedger, { props: { projection, month: '2026-01' } });
    const rows = wrapper.findAll('.row');
    expect(rows.length).toBe(projection.events.filter((e) => e.date.startsWith('2026-01')).length);
  });

  it('marks a negative running balance with both colour and a non-colour marker', () => {
    const wrapper = mount(HorizonLedger, { props: { projection, month: '2026-01' } });
    expect(wrapper.find('.balance.negative').exists()).toBe(true);
    expect(wrapper.find('.marker').exists()).toBe(true);
  });

  it('shows the honest "in design" marker', () => {
    const wrapper = mount(HorizonLedger, { props: { projection, month: '2026-01' } });
    expect(wrapper.text()).toContain('In design');
  });

  it('shows the covered period next to a payment that has one (D4)', () => {
    const wrapper = mount(HorizonLedger, { props: { projection, month: '2026-01' } });
    expect(wrapper.text()).toContain('covers next month');
  });
});
