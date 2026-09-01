<script setup lang="ts">
// Shared Add/Edit form — presentational + validation only. No
// useExpenses/usePocketHome/useToast/router imports: parents own
// data-fetching, mutation calls, toasts, and navigation, and pass the
// summary/rates this form needs for its live preview line as props.
import {
  CURRENCIES,
  CURRENCY_EXPONENT,
  type Currency,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import type { FxRate } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import type { SwatchSlot } from '@roman-mik/kapa-core/theme';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useCategories } from '@/composables/useCategories';
import {
  usePocketEntryPreview,
  type EntryDraft,
  type EntryPreviewExclusion,
} from '@/composables/usePocketEntryPreview';
import type { PocketSummary } from '@/composables/usePocketHome';
import { formatFullDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { swatchCssVar } from '@/lib/swatch';
import { expenseDateSchema, firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';

export interface ExpenseDraftPayload {
  amountMinor: number;
  currency: Currency;
  categoryId: string | null;
  note: string | null;
  date: string; // zoned date key
}

const props = defineProps<{
  mode: 'add' | 'edit';
  initialValues?: ExpenseDraftPayload;
  summary: PocketSummary | null;
  rates: FxRate[];
  excludeFromPreview?: EntryPreviewExclusion | null;
  submitting?: boolean;
  submitError?: string | null;
}>();

const emit = defineEmits<{
  submit: [payload: ExpenseDraftPayload, options: { keepAdding: boolean }];
  cancel: [];
}>();

const space = useSpaceStore();
// Edit reaches expenses that may carry an archived category — a plain Add
// only ever offers active ones.
const { categories } = useCategories({ includeArchived: props.mode === 'edit' });

const timeZone = space.currentSpace?.timezone ?? 'UTC';
const todayKey = computed(() => zonedDateKey(new Date(), timeZone));

function initialAmountString(): string {
  const init = props.initialValues;
  if (!init) return '';
  const exponent = CURRENCY_EXPONENT[init.currency];
  return String(init.amountMinor / 10 ** exponent);
}

const amount = ref(initialAmountString());
const currency = ref<Currency>(
  props.initialValues?.currency ?? ((space.currentSpace?.currency ?? 'RSD') as Currency)
);
const categoryId = ref<string>(props.initialValues?.categoryId ?? '');
const note = ref(props.initialValues?.note ?? '');
const spentAtKey = ref(props.initialValues?.date ?? todayKey.value);
const localError = ref<string | null>(null);
const expandedField = ref<'category' | 'date' | 'note' | null>(null);

const exponent = computed(() => CURRENCY_EXPONENT[currency.value]);

// A zero-decimal currency (e.g. RSD) can't carry a fractional amount typed
// while a two-decimal currency was selected — truncate rather than leave a
// value the exponent can't represent.
watch(currency, () => {
  if (exponent.value === 0 && amount.value.includes('.')) {
    amount.value = amount.value.split('.')[0];
  }
});

const KEYPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'];

function pressKey(key: string): void {
  if (key === '⌫') {
    amount.value = amount.value.slice(0, -1);
    return;
  }
  if (key === '.') {
    if (exponent.value === 0 || amount.value.includes('.')) return;
    amount.value = amount.value === '' ? '0.' : amount.value + '.';
    return;
  }
  const decimals = amount.value.split('.')[1];
  if (decimals !== undefined && decimals.length >= exponent.value) return;
  if (amount.value === '0') {
    amount.value = key;
  } else {
    amount.value += key;
  }
}

function toggleField(field: 'category' | 'date' | 'note'): void {
  expandedField.value = expandedField.value === field ? null : field;
}

function categoryName(id: string): string {
  if (id === '') return 'Uncategorized';
  return categories.value.find((c) => c.id === id)?.name ?? 'Uncategorized';
}

const dateLabel = computed(() =>
  spentAtKey.value === todayKey.value ? 'Today' : formatFullDate(spentAtKey.value)
);

const draft = computed<EntryDraft | null>(() => {
  const value = Number(amount.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    amountMinor: Math.round(value * 10 ** exponent.value),
    currency: currency.value,
    date: spentAtKey.value || todayKey.value,
  };
});

const excludeRef = computed(() => props.excludeFromPreview ?? null);
const preview = usePocketEntryPreview(
  draft,
  computed(() => props.summary),
  computed(() => props.rates),
  excludeRef
);

function buildPayload(): ExpenseDraftPayload | null {
  localError.value = null;
  const parsed = positiveAmountSchema.safeParse(amount.value);
  if (!parsed.success) {
    localError.value = firstIssueMessage(parsed) ?? 'Enter a valid amount.';
    return null;
  }
  const parsedDate = expenseDateSchema.safeParse(spentAtKey.value);
  if (!parsedDate.success) {
    localError.value = firstIssueMessage(parsedDate) ?? 'Pick a valid date.';
    return null;
  }
  return {
    amountMinor: Math.round(parsed.data * 10 ** exponent.value),
    currency: currency.value,
    categoryId: categoryId.value || null,
    note: note.value.trim() || null,
    date: spentAtKey.value,
  };
}

function onSubmit(keepAdding: boolean): void {
  const payload = buildPayload();
  if (!payload) return;
  emit('submit', payload, { keepAdding });
}

function reset(opts?: {
  keepCategory?: boolean;
  keepCurrency?: boolean;
  keepDate?: boolean;
}): void {
  amount.value = '';
  note.value = '';
  localError.value = null;
  expandedField.value = null;
  if (!opts?.keepCategory) categoryId.value = '';
  if (!opts?.keepCurrency) currency.value = (space.currentSpace?.currency ?? 'RSD') as Currency;
  if (!opts?.keepDate) spentAtKey.value = todayKey.value;
}

defineExpose({ reset });
</script>

<template>
  <form class="form" @submit.prevent="onSubmit(false)">
    <div class="amount-display">{{ amount || '0' }}</div>

    <div class="keypad">
      <button
        v-for="key in KEYPAD_KEYS"
        :key="key"
        type="button"
        class="keypad-key"
        @click="pressKey(key)"
      >
        {{ key }}
      </button>
    </div>

    <div class="segmented" role="radiogroup" aria-label="Currency">
      <BaseButton
        v-for="c in CURRENCIES"
        :key="c"
        type="button"
        :variant="currency === c ? 'primary' : 'secondary'"
        @click="currency = c"
      >
        {{ c }}
      </BaseButton>
    </div>

    <div class="chip-fields">
      <template v-if="expandedField === 'category'">
        <div class="chips" role="radiogroup" aria-label="Category">
          <BaseButton
            type="button"
            :variant="categoryId === '' ? 'primary' : 'secondary'"
            @click="
              categoryId = '';
              expandedField = null;
            "
          >
            Uncategorized
          </BaseButton>
          <BaseButton
            v-for="c in categories"
            :key="c.id"
            type="button"
            :variant="categoryId === c.id ? 'primary' : 'secondary'"
            @click="
              categoryId = c.id;
              expandedField = null;
            "
          >
            <span class="chip-inner">
              <span
                class="chip-dot"
                :style="c.color ? { background: swatchCssVar(c.color as SwatchSlot) } : undefined"
                :class="{ 'chip-dot--empty': !c.color }"
              />
              {{ c.name }}
            </span>
          </BaseButton>
        </div>
      </template>
      <button v-else type="button" class="summary-chip" @click="toggleField('category')">
        {{ categoryName(categoryId) }}
      </button>

      <template v-if="expandedField === 'date'">
        <BaseField label="Date" v-slot="{ id }">
          <BaseInput
            :id="id"
            v-model="spentAtKey"
            type="date"
            :max="todayKey"
            data-autofocus
            @change="expandedField = null"
          />
        </BaseField>
      </template>
      <button v-else type="button" class="summary-chip" @click="toggleField('date')">
        {{ dateLabel }}
      </button>

      <template v-if="expandedField === 'note'">
        <BaseField label="Note" v-slot="{ id }">
          <BaseInput :id="id" v-model="note" type="text" data-autofocus />
        </BaseField>
      </template>
      <button v-else type="button" class="summary-chip" @click="toggleField('note')">
        {{ note || 'Add a note' }}
      </button>
    </div>

    <p v-if="preview" class="hint" :class="{ negative: preview.remainingAfterMinor < 0 }">
      {{ formatMoney(preview.remainingAfterMinor, summary!.currency) }} left after this.
    </p>

    <p v-if="localError" role="alert" class="error">{{ localError }}</p>
    <p v-else-if="submitError" role="alert" class="error">{{ submitError }}</p>

    <div class="actions">
      <BaseButton type="submit" block :disabled="submitting">
        {{ submitting ? 'Saving…' : 'Save' }}
      </BaseButton>
      <BaseButton
        v-if="mode === 'add'"
        type="button"
        variant="secondary"
        block
        :disabled="submitting"
        @click="onSubmit(true)"
      >
        Save · keep adding
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.amount-display {
  font-size: var(--kapa-text-display-size);
  font-weight: 700;
  text-align: center;
  padding: var(--kapa-space-3) 0;
}

.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--kapa-space-2);
}

.keypad-key {
  font: inherit;
  font-size: var(--kapa-text-title-size);
  padding: var(--kapa-space-3) 0;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
  transition: background-color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.keypad-key:hover {
  background: var(--kapa-neutral-200);
}

.segmented,
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
}

.chip-fields {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.summary-chip {
  align-self: flex-start;
  font: inherit;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  border-radius: var(--kapa-radius-pill, 999px);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
}

.summary-chip:hover {
  background: var(--kapa-neutral-200);
}

.chip-inner {
  display: inline-flex;
  align-items: center;
  gap: var(--kapa-space-1);
}

.chip-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chip-dot--empty {
  border: 1px dashed currentColor;
}

.hint {
  margin: 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.hint.negative {
  color: var(--kapa-negative);
  font-weight: 600;
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}
</style>
