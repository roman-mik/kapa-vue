import { computed, watch, type Ref } from 'vue';
import {
  applyCautiousScenario,
  cautiousCandidates,
  computeDecisionSummary,
  buildProjection,
  occurrenceFingerprint,
  type ProjectionInput,
  type ProjectionResult,
} from '@roman-mik/kapa-core/horizon';
import type { Converted } from '@roman-mik/kapa-core/pocket';
import { useCautiousScenarioStore } from '@/stores/cautiousScenario';
import { useSpaceStore } from '@/stores/space';
import { useSessionStore } from '@/stores/session';
import { useHorizonSettingsResource } from './useHorizonSettingsResource';
import { useAccounts } from './useAccounts';
export function useCashflowDecision(
  data: Ref<(Converted<ProjectionResult> & { input?: ProjectionInput }) | undefined>,
  loading: Ref<boolean>,
  error: Ref<string | null>
) {
  const settings = useHorizonSettingsResource();
  const store = useCautiousScenarioStore();
  const space = useSpaceStore();
  const session = useSessionStore();
  const accounts = useAccounts();
  watch(
    [() => session.user?.id, () => space.currentSpaceId],
    ([user, id]) => store.bind(JSON.stringify([user, id])),
    { immediate: true, flush: 'sync' }
  );
  const input = computed(() => data.value?.input);
  const reserveMismatch = computed(
    () =>
      settings.data.value?.reserve_minor != null &&
      settings.data.value.reserve_currency !== settings.data.value.reporting_currency
  );
  const reserve = computed(() =>
    reserveMismatch.value ? null : (settings.data.value?.reserve_minor ?? 0)
  );
  const calculation = computed(() => {
    const base = input.value;
    if (!base || !data.value) return { value: null, error: '' };
    try {
      const changed = store.mode === 'cautious' ? applyCautiousScenario(base, store.draft) : base;
      const result = changed === base ? data.value : buildProjection(changed);
      // Loader-level missing FX/history qualifications are shared, never erased by a trial.
      const combined = {
        ...result,
        unconverted: [...result.unconverted, ...(changed === base ? [] : data.value.unconverted)],
      };
      return {
        value: {
          input: changed,
          projection: combined,
          summary: computeDecisionSummary(changed, combined, reserve.value),
        },
        error: '',
      };
    } catch (err) {
      return {
        value: null,
        error: err instanceof Error ? err.message : 'Review the cautious draft.',
      };
    }
  });
  const candidates = computed(() => {
    if (!input.value) return [];
    const all = cautiousCandidates(input.value);
    const laterIncome = all
      .filter(
        (o) =>
          o.expected.amountMinor > 0 && (o.postponedDate ?? o.expected.date) > input.value!.range.to
      )
      .sort((a, b) =>
        (a.postponedDate ?? a.expected.date).localeCompare(b.postponedDate ?? b.expected.date)
      )[0];
    return all.filter(
      (o) => (o.postponedDate ?? o.expected.date) <= input.value!.range.to || o === laterIncome
    );
  });
  const ready = computed(
    () =>
      !loading.value &&
      !error.value &&
      !settings.loading.value &&
      !settings.error.value &&
      !!calculation.value.value
  );
  const qualified = computed(
    () => ready.value && calculation.value.value?.summary.complete === true
  );
  const staleChanges = computed(() =>
    store.draft.changes.filter((c) => {
      const current = candidates.value.find((o) => o.expected.key === c.occurrenceKey);
      return !current || occurrenceFingerprint(current) !== c.fingerprint;
    })
  );
  function reviewChange(key: string) {
    const current = candidates.value.find((o) => o.expected.key === key);
    if (!current) return;
    store.draft = {
      ...store.draft,
      changes: store.draft.changes.map((c) =>
        c.occurrenceKey === key ? { ...c, fingerprint: occurrenceFingerprint(current) } : c
      ),
    };
  }
  return {
    store,
    input,
    candidates,
    ready,
    qualified,
    reserve,
    reserveMismatch,
    staleChanges,
    reviewChange,
    error: computed(() => calculation.value.error || error.value || settings.error.value || ''),
    result: computed(() => calculation.value.value),
    accountNames: computed(() => new Map(accounts.accounts.value.map((a) => [a.id, a.name]))),
    observations: computed(() => input.value?.lifecycle?.observations ?? []),
  };
}
export type CashflowDecision = ReturnType<typeof useCashflowDecision>;
