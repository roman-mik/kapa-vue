import { reconcileBalances, type ReconcileEntry } from '@roman-mik/kapa-core/horizon';
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import { createOneOffEvent } from '@roman-mik/kapa-core/horizon/queries';
import { CURRENCY_EXPONENT, zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import { reactive, ref, watch } from 'vue';
import { supabase } from '@/lib/supabase';
import { useSpaceStore } from '@/stores/space';

/** Per-account reconcile form state: the actual balance (major string) + optional note. */
export interface ReconcileDraft {
  actual: string;
  note: string;
}

/**
 * Balance reconcile (A4): quick actual-vs-projected balance entry with
 * variance logging. Given the active accounts, this holds the user's draft
 * balance entry per account, derives each account's variance live, saves the
 * reconcile (a durable `balance_snapshots` row + resetting the account's
 * `current_balance_minor`), and can log a non-zero variance as a one-off
 * event so the model is auditable end-to-end.
 *
 * This is pure state + orchestration over kapa-core's `reconcileBalances`/
 * `createOneOffEvent` and `varianceMinor` — no arithmetic lives here.
 */
export function useReconcile(getAccounts: () => Account[], onSaved: () => void | Promise<void>) {
  const space = useSpaceStore();

  const activeAccounts = () => getAccounts().filter((a) => !a.archived);

  // Draft balance/note per account, keyed by account id. Initialized lazily
  // from each account's current balance so the row opens pre-filled with the
  // expected figure (matching the tracker's ReconcilePanel behavior).
  const drafts = reactive<Record<string, ReconcileDraft>>({});
  const saving = ref(false);
  const saveError = ref<string | null>(null);

  function majorToMinor(major: string, exponent: number): number {
    const n = Number(major.replace(',', '.'));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 10 ** exponent);
  }

  function getDraft(account: Account): ReconcileDraft {
    const existing = drafts[account.id];
    if (existing) return existing;
    const exponent = CURRENCY_EXPONENT[account.currency as Currency];
    const created = {
      actual: formatMajor(account.current_balance_minor, exponent),
      note: '',
    };
    drafts[account.id] = created;
    return created;
  }

  /** The variance (actual − expected) in minor units for a single account. */
  function varianceFor(account: Account): number {
    const draft = getDraft(account);
    const actualMinor = majorToMinor(draft.actual, CURRENCY_EXPONENT[account.currency as Currency]);
    return actualMinor - account.current_balance_minor;
  }

  /** The initialized draft for an account (create-if-missing, so templates can v-model into it). */
  function draftFor(account: Account): ReconcileDraft {
    return getDraft(account);
  }

  async function save(): Promise<boolean> {
    const spaceId = space.currentSpaceId;
    if (!spaceId) return false;

    // Use the account's current balance as-is if the field wasn't touched;
    // normalize the draft's number regardless so the stored actual matches
    // what the user sees.
    const entries: ReconcileEntry[] = activeAccounts().map((account) => {
      const draft = getDraft(account);
      return {
        accountId: account.id,
        balanceMinor: majorToMinor(draft.actual, CURRENCY_EXPONENT[account.currency as Currency]),
        note: draft.note || undefined,
      };
    });

    saving.value = true;
    saveError.value = null;
    try {
      await reconcileBalances(supabase, spaceId, entries);

      // Reset drafts to each account's newly-persisted balance so the panel
      // re-opens with the reconciled figure, and reflect the new balances.
      for (const account of activeAccounts()) {
        drafts[account.id] = {
          actual: formatMajor(
            account.current_balance_minor,
            CURRENCY_EXPONENT[account.currency as Currency]
          ),
          note: '',
        };
      }
      await onSaved();
      return true;
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : "Couldn't save the reconciliation.";
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Log a non-zero variance as a one-off event (the "log it as an event"
   * flow). A positive variance (actual > expected) means the model
   * under-counted — an 'in' windfall; a negative variance means money left —
   * an 'out' cost. Uses today (the space's timezone) as the event date, since
   * the reconcile happens now.
   */
  async function logAsOneOff(account: Account): Promise<boolean> {
    const currentSpace = space.currentSpace;
    const spaceId = space.currentSpaceId;
    if (!currentSpace || !spaceId) return false;

    const variance = varianceFor(account);
    if (variance === 0) return false;

    const direction = variance > 0 ? 'in' : 'out';
    const sign = variance > 0 ? 1 : -1;
    const todayKey = zonedDateKey(new Date(), currentSpace.timezone);

    try {
      await createOneOffEvent(supabase, {
        space_id: spaceId,
        account_id: account.id,
        currency: account.currency,
        name: 'Balance reconcile',
        category: 'other',
        amount_minor: sign * variance,
        date: todayKey,
        direction,
      });
      await onSaved();
      return true;
    } catch (err) {
      saveError.value = err instanceof Error ? err.message : "Couldn't log the variance.";
      return false;
    }
  }

  // Clear drafts when the space changes so a reconcile never leaks from one
  // space into another.
  watch(
    () => space.currentSpaceId,
    () => {
      for (const key of Object.keys(drafts)) delete drafts[key];
    }
  );

  return { drafts, saving, saveError, activeAccounts, draftFor, varianceFor, save, logAsOneOff };
}

function formatMajor(minor: number, exponent: number): string {
  return String(minor / 10 ** exponent);
}
