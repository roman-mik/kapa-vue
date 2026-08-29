import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';

const CSV_HEADER = ['date', 'category', 'amount_minor', 'currency', 'note'];

// Amounts stay in minor units rather than being formatted — a re-import or
// a spreadsheet SUM() shouldn't have to undo locale-formatted currency
// strings to get back an exact integer.
function toCsvField(value: string): string {
  // Guard against spreadsheet formula injection (CWE-1236): a field that
  // starts with =, +, -, or @ is treated as a formula when the sheet opens.
  // Prefix it with a single quote so it renders as literal text. Amounts are
  // always digits or empty, so no numeric column is affected.
  const guarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

// Leading UTF-8 BOM so spreadsheet apps (Excel-on-Windows in particular)
// detect UTF-8 instead of misreading non-ASCII notes as the legacy codepage.
const UTF8_BOM = '\uFEFF';

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
  return UTF8_BOM + [CSV_HEADER.join(','), ...lines].join('\n');
}
