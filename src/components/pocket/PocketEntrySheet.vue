<script setup lang="ts">
// The single globally-mounted host for the Add flow (see App.vue) — the only
// place that calls useExpenses().add() and usePocketHome() for it. Opened
// either from the /pocket/add route (AddExpenseView.vue, a thin opener) or
// from a Duplicate row action (History/Home), which pre-fills a draft here
// instead of writing immediately.
import { computed, ref } from 'vue';
import { dateKeyStartUtc, zonedDateKey } from '@roman-mik/kapa-core/pocket';
import BaseSheet from '@/components/ui/BaseSheet.vue';
import ExpenseEntryForm, {
  type ExpenseDraftPayload,
} from '@/components/pocket/ExpenseEntryForm.vue';
import { usePocketEntrySheet } from '@/composables/usePocketEntrySheet';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useToast } from '@/composables/useToast';
import { useSpaceStore } from '@/stores/space';

const sheet = usePocketEntrySheet();
const { add } = useExpenses();
const { summary, rates } = usePocketHome();
const toast = useToast();
const space = useSpaceStore();

const submitting = ref(false);
const submitError = ref<string | null>(null);
const formRef = ref<InstanceType<typeof ExpenseEntryForm> | null>(null);

const timeZone = computed(() => space.currentSpace?.timezone ?? 'UTC');
const todayKey = computed(() => zonedDateKey(new Date(), timeZone.value));

const initialValues = computed<ExpenseDraftPayload | undefined>(() =>
  sheet.prefill.value ? { ...sheet.prefill.value, date: todayKey.value } : undefined
);

async function onSubmit(
  payload: ExpenseDraftPayload,
  { keepAdding }: { keepAdding: boolean }
): Promise<void> {
  submitError.value = null;
  submitting.value = true;
  try {
    await add({
      amountMinor: payload.amountMinor,
      currency: payload.currency,
      categoryId: payload.categoryId,
      note: payload.note,
      spentAt: dateKeyStartUtc(payload.date, timeZone.value).toISOString(),
    });
    toast.success('Expense added');
    if (keepAdding) {
      formRef.value?.reset({ keepCategory: true, keepCurrency: true, keepDate: true });
    } else {
      sheet.close();
    }
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : "Couldn't add that expense.";
    toast.error(submitError.value);
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BaseSheet :open="sheet.isOpen.value" labelled-by="pocket-add-title" @close="sheet.close()">
    <h2 id="pocket-add-title">Add expense</h2>
    <ExpenseEntryForm
      ref="formRef"
      mode="add"
      :initial-values="initialValues"
      :summary="summary"
      :rates="rates"
      :submitting="submitting"
      :submit-error="submitError"
      @submit="onSubmit"
      @cancel="sheet.close()"
    />
  </BaseSheet>
</template>
