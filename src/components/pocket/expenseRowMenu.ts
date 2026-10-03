// A single per-row "···" menu shared by any list row that needs a few
// actions without a dedicated button per action. `kind: 'action'` covers
// both a direct call (Edit, Duplicate) and, for a future caller, an action
// that opens an external inline editor (e.g. a rename form) — that
// distinction lives entirely in the parent's `@select` handler, not in
// ExpenseRowMenu.vue. `kind: 'confirm'` swaps that row to an inline
// ConfirmButton, reusing its existing arm/confirm state machine unmodified.
export interface RowMenuAction {
  id: string;
  label: string;
  kind: 'action' | 'confirm';
  /** Required when kind === 'confirm'; ConfirmButton's own default otherwise. */
  confirmLabel?: string;
  armedMs?: number;
  disabled?: boolean;
}
