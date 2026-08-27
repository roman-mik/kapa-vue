import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';

const CSV_HEADER = ['date', 'category', 'amount_minor', 'currency', 'note'];

// Amounts stay in minor units rather than being formatted — a re-import or
// a spreadsheet SUM() shouldn't have to undo locale-formatted currency
// strings to get back an exact integer.
function toCsvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function expensesToCsv(rows: ExpenseView[]): string {
  const lines = rows.map((row) =>
    [
      row.spent_at ?? '',
      row.category_name ?? 'Uncategorized',
      String(row.amount_minor ?? 0),
      row.currency ?? '',
      row.note ?? '',
    ]
      .map(toCsvField)
      .join(',')
  );
  return [CSV_HEADER.join(','), ...lines].join('\n');
}
