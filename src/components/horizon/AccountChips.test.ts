import type { Account } from '@roman-mik/kapa-core/horizon';
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vite-plus/test';
import AccountChips from './AccountChips.vue';

const accounts: Account[] = [
  {
    id: 'a1',
    space_id: 's1',
    name: 'Checking',
    currency: 'EUR',
    current_balance_minor: 12345,
    type: 'bank',
    include_in_total: true,
    archived: false,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'a2',
    space_id: 's1',
    name: 'Cash',
    currency: 'USD',
    current_balance_minor: 500,
    type: 'cash',
    include_in_total: false,
    archived: false,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

describe('AccountChips', () => {
  it('renders each account as a chip with its name and native-currency balance', () => {
    const wrapper = mount(AccountChips, { props: { accounts } });
    const chips = wrapper.findAll('li.chip');
    expect(chips).toHaveLength(2);
    expect(chips[0].text()).toContain('Checking');
    expect(chips[1].text()).toContain('Cash');
    // Native-currency formatting: EUR 123.45 renders with the euro symbol.
    expect(chips[0].text()).toContain('123.45');
    expect(chips[0].text()).toMatch(/€/);
  });

  it('renders an empty list when no accounts', () => {
    const wrapper = mount(AccountChips, { props: { accounts: [] } });
    expect(wrapper.findAll('li.chip')).toHaveLength(0);
  });
});
