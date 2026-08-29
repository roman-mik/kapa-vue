import { describe, expect, it } from 'vite-plus/test';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { expensesToCsv } from './csv';

const BOM = '\uFEFF';

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
  it('writes a header and one row per expense, amounts in minor units, prefixed with a UTF-8 BOM', () => {
    const csv = expensesToCsv([row({ category_name: 'Groceries', amount_minor: 1550 })]);

    expect(csv).toBe(
      BOM + 'date,category,amount_minor,currency,note\n2026-08-15T00:00:00Z,Groceries,1550,RSD,'
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

  it('guards against spreadsheet formula injection in leading =, +, -, and @', () => {
    expect(expensesToCsv([row({ note: '=2+5*3' })])).toContain(",'=2+5*3");
    expect(expensesToCsv([row({ note: '@SUM(A1:A2)' })])).toContain(",'@SUM(A1:A2)");
    expect(expensesToCsv([row({ note: '+123' })])).toContain(",'+123");
    expect(expensesToCsv([row({ note: '-123' })])).toContain(",'-123");
  });

  it('leaves ordinary text and amounts untouched (no spurious quote guard)', () => {
    expect(expensesToCsv([row({ note: 'fitting room 12' })])).toContain(',fitting room 12');
    expect(expensesToCsv([row({ category_name: 'Coffee' })])).toContain(',Coffee,');
  });

  it('returns just the header (plus BOM) for an empty list', () => {
    expect(expensesToCsv([])).toBe(BOM + 'date,category,amount_minor,currency,note');
  });
});
