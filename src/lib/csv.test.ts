import { describe, expect, it } from 'vite-plus/test';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { expensesToCsv } from './csv';

function row(overrides: Partial<ExpenseView> = {}): ExpenseView {
  return {
    id: 'e1',
    space_id: 's1',
    user_id: 'u1',
    category_id: null,
    category_name: null,
    amount_minor: 1000,
    currency: 'RSD',
    note: null,
    spent_at: '2026-08-15T00:00:00Z',
    created_at: '2026-08-15T00:00:00Z',
    updated_at: '2026-08-15T00:00:00Z',
    ...overrides,
  } as ExpenseView;
}

describe('expensesToCsv', () => {
  it('writes a header and one row per expense, amounts in minor units', () => {
    const csv = expensesToCsv([row({ category_name: 'Groceries', amount_minor: 1550 })]);

    expect(csv).toBe(
      'date,category,amount_minor,currency,note\n2026-08-15T00:00:00Z,Groceries,1550,RSD,'
    );
  });

  it("falls back to 'Uncategorized' when category_name is null", () => {
    const csv = expensesToCsv([row({ category_name: null })]);

    expect(csv).toContain(',Uncategorized,');
  });

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = expensesToCsv([row({ note: 'lunch, "the good one"' })]);

    expect(csv).toContain('"lunch, ""the good one"""');
  });

  it('returns just the header for an empty list', () => {
    expect(expensesToCsv([])).toBe('date,category,amount_minor,currency,note');
  });
});
