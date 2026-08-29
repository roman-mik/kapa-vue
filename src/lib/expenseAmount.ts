import type { Currency, ExpenseAmount } from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';

export function toExpenseAmount(row: ExpenseView): ExpenseAmount {
  return {
    categoryId: row.category_id,
    amountMinor: row.amount_minor ?? 0,
    currency: (row.currency ?? 'RSD') as Currency,
    spentAt: row.spent_at ?? new Date().toISOString(),
  };
}
