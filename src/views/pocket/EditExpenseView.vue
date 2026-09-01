<script setup lang="ts">
// Thin deep-link wrapper: normal editing happens in-place on History's row
// (see HistoryView.vue's expandedId state); this route exists only so
// /pocket/edit/:id is bookmarkable/shareable on its own, rendering the same
// ExpenseEntryForm inside a dialog since a direct link has no row to expand
// into.
import {
  CURRENCY_EXPONENT,
  type Currency,
  dateKeyStartUtc,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseSheet from '@/components/ui/BaseSheet.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import ExpenseEntryForm, {
  type ExpenseDraftPayload,
} from '@/components/pocket/ExpenseEntryForm.vue';
import type { EntryPreviewExclusion } from '@/composables/usePocketEntryPreview';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useToast } from '@/composables/useToast';
import { useSpaceStore } from '@/stores/space';

const route = useRoute();
const router = useRouter();
const space = useSpaceStore();
const { update, getById } = useExpenses();
const { summary, rates } = usePocketHome();
const toast = useToast();

const timeZone = computed(() => space.currentSpace?.timezone ?? 'UTC');
const expenseId = computed(() => route.params.id as string);

const original = ref<ExpenseView | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
const submitting = ref(false);
const submitError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = null;
  try {
    const expense = await getById(expenseId.value);
    if (!expense) {
      loadError.value = 'This expense no longer exists.';
      return;
    }
    original.value = expense;
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : "Couldn't load this expense.";
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function dateKeyOf(expense: ExpenseView): string {
  return expense.spent_at
    ? zonedDateKey(new Date(expense.spent_at), timeZone.value)
    : zonedDateKey(new Date(), timeZone.value);
}

const initialValues = computed<ExpenseDraftPayload | undefined>(() => {
  const expense = original.value;
  if (!expense) return undefined;
  return {
    amountMinor: expense.amount_minor ?? 0,
    currency: (expense.currency ?? 'RSD') as Currency,
    categoryId: expense.category_id,
    note: expense.note,
    date: dateKeyOf(expense),
  };
});

const excludeFromPreview = computed<EntryPreviewExclusion | null>(() => {
  const expense = original.value;
  if (!expense) return null;
  return {
    amountMinor: expense.amount_minor ?? 0,
    currency: (expense.currency ?? 'RSD') as Currency,
    date: dateKeyOf(expense),
  };
});

async function onSubmit(payload: ExpenseDraftPayload): Promise<void> {
  submitError.value = null;
  submitting.value = true;
  try {
    // The write is scoped to the `updated_at` this screen loaded — if another
    // member saved first, kapa-core refuses the clobber and we reload the
    // latest version (discarding this form's values) so the user reviews the
    // other change before saving again.
    const outcome = await update(
      expenseId.value,
      {
        amount_minor: payload.amountMinor,
        currency: payload.currency,
        category_id: payload.categoryId,
        note: payload.note,
        spent_at: dateKeyStartUtc(payload.date, timeZone.value).toISOString(),
      },
      original.value?.updated_at ?? ''
    );
    if (!outcome.ok) {
      submitError.value =
        'This expense changed elsewhere while you were editing. Review the latest version and try again.';
      toast.error(submitError.value);
      await load();
      return;
    }
    toast.success('Expense updated');
    await router.push({ name: 'pocket-history' });
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : "Couldn't save that expense.";
    toast.error(submitError.value);
  } finally {
    submitting.value = false;
  }
}

function onClose(): void {
  router.push({ name: 'pocket-history' });
}
</script>

<template>
  <main class="page">
    <template v-if="loading">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="loadError" role="alert" class="error">{{ loadError }}</p>

    <BaseSheet v-else :open="true" labelled-by="pocket-edit-title" @close="onClose">
      <h2 id="pocket-edit-title">Edit expense</h2>
      <ExpenseEntryForm
        :key="`${expenseId}-${original?.updated_at ?? ''}`"
        mode="edit"
        :initial-values="initialValues"
        :exclude-from-preview="excludeFromPreview"
        :summary="summary"
        :rates="rates"
        :submitting="submitting"
        :submit-error="submitError"
        @submit="onSubmit"
        @cancel="onClose"
      />
    </BaseSheet>
  </main>
</template>

<style scoped>
.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
