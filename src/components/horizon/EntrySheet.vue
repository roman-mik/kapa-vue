<script setup lang="ts">
// Task 11 — the amount-first creation sheet. Calls the four composables'
// add() directly (no dependency on IncomeStreamForm/ObligationForm/
// PlannedSpendForm/OneOffEventForm — those stay the legacy edit-path forms).
// Kind is never picked up front: it's inferred from which chips are set
// (see `kind` below). `expandedChip` is raw UI state, not a derived value,
// so a plain ref is correct per the no-derivation-in-templates rule.
import { CHARGE_CADENCES, type ChargeCadence } from '@roman-mik/kapa-core/horizon';
import { CURRENCY_EXPONENT, zonedDateKey, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import BaseSheet from '@/components/ui/BaseSheet.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useEntryDryRun } from '@/composables/useEntryDryRun';
import { useIncomeStreams, type NewIncomeStream } from '@/composables/useIncomeStreams';
import {
  useObligations,
  OBLIGATION_CATEGORY_LABELS,
  type NewObligation,
  type ObligationCategory,
} from '@/composables/useObligations';
import {
  useOneOffEvents,
  ONE_OFF_CATEGORY_LABELS,
  type NewOneOffEvent,
} from '@/composables/useOneOffEvents';
import { usePlannedSpend, type NewPlannedSpend } from '@/composables/usePlannedSpend';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
import { firstIssueMessage, positiveAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';
import type { DraftEntry } from '@/lib/horizon/dryRunProjection';

const props = defineProps<{ open: boolean; defaultSide: 'in' | 'out' }>();
const emit = defineEmits<{ close: [] }>();

const space = useSpaceStore();
const toast = useToast();
const { accounts, refresh: refreshAccounts } = useAccounts();
const incomeStreams = useIncomeStreams();
const obligations = useObligations();
const oneOffEvents = useOneOffEvents();
const plannedSpend = usePlannedSpend();
const dryRun = useEntryDryRun();

type Chip = 'recurring' | 'category' | 'planned' | 'date' | 'account' | 'confidence' | 'name';

const side = ref<'in' | 'out'>(props.defaultSide);
const amount = ref('');
const currency = ref<Currency>(space.currentSpace?.currency ?? 'RSD');
const name = ref('');
const accountId = ref('');
const recurring = ref(false);
const planned = ref(false);
const when = ref<'dayOfMonth' | 'monthEnd'>('dayOfMonth');
const day = ref('1');
const cadence = ref<ChargeCadence>('daily');
const cap = ref('');
const obligationCategory = ref<ObligationCategory>('other');
const oneOffCategory = ref<import('@/composables/useOneOffEvents').OneOffCategory>('other');
const date = ref('');
const confidence = ref<'confirmed' | 'expected' | 'uncertain'>('confirmed');
const expandedChip = ref<Chip | null>(null);
const saving = ref(false);
const saveError = ref<string | null>(null);

function todayKey(): string {
  return space.currentSpace ? zonedDateKey(new Date(), space.currentSpace.timezone) : '';
}

function resetTransient(): void {
  amount.value = '';
  name.value = '';
}

function resetAll(): void {
  resetTransient();
  side.value = props.defaultSide;
  currency.value = space.currentSpace?.currency ?? 'RSD';
  accountId.value = accounts.value[0]?.id ?? '';
  recurring.value = false;
  planned.value = false;
  when.value = 'dayOfMonth';
  day.value = '1';
  cadence.value = 'daily';
  cap.value = '';
  obligationCategory.value = 'other';
  oneOffCategory.value = 'other';
  date.value = todayKey();
  confidence.value = 'confirmed';
  expandedChip.value = null;
  saveError.value = null;
}

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    await refreshAccounts();
    resetAll();
    await dryRun.loadBaseline();
  },
  { immediate: true }
);

function toggleChip(chip: Chip): void {
  expandedChip.value = expandedChip.value === chip ? null : chip;
}

function exponentFor(c: Currency): number {
  return CURRENCY_EXPONENT[c] ?? 2;
}

// Kind inference (see the accepted plan's table): `in` is always a
// fixed-amount income stream; on `out`, Planned beats Recurring beats the
// one-off default — the two are kept mutually exclusive in the UI so they
// can never both be "on" at once.
const kind = computed<'incomeStream' | 'obligation' | 'plannedSpend' | 'oneOff'>(() => {
  if (side.value === 'in') return 'incomeStream';
  if (planned.value) return 'plannedSpend';
  if (recurring.value) return 'obligation';
  return 'oneOff';
});

function setPlanned(value: boolean): void {
  planned.value = value;
  if (value) recurring.value = false;
}

function setRecurring(value: boolean): void {
  recurring.value = value;
  if (value) planned.value = false;
}

function parsedAmountMinor(): number | null {
  const parsed = positiveAmountSchema.safeParse(amount.value);
  if (!parsed.success) return null;
  return Math.round(parsed.data * 10 ** exponentFor(currency.value));
}

function buildDraft(amountMinor: number): DraftEntry {
  const entryDate = date.value || todayKey();
  const entryName = name.value.trim() || '(untitled)';
  if (kind.value === 'incomeStream') {
    const value: NewIncomeStream = {
      name: entryName,
      kind: 'fixed',
      currency: currency.value,
      accountId: accountId.value,
      startDate: recurring.value ? entryDate : entryDate,
      earningPeriodKind: 'monthly',
      hourlyRateMinor: null,
      hoursPerDayE2: null,
      lagDays: 0,
      amountMinor,
      paymentRule: when.value,
      payDay: Number(day.value) || 1,
      taxable: false,
      confidence: confidence.value,
      recurrence: recurring.value ? 'recurring' : 'oneOff',
    };
    return { kind: 'incomeStream', value };
  }
  if (kind.value === 'plannedSpend') {
    const value: NewPlannedSpend = {
      name: entryName,
      categoryId: null,
      currency: currency.value,
      accountId: accountId.value,
      dailyAmountMinor: amountMinor,
      chargeCadence: cadence.value,
      capMinor: cap.value
        ? Math.round(Number(cap.value) * 10 ** exponentFor(currency.value))
        : null,
      startDate: entryDate,
      endDate: null,
    };
    return { kind: 'plannedSpend', value };
  }
  if (kind.value === 'obligation') {
    const value: NewObligation = {
      name: entryName,
      category: obligationCategory.value,
      currency: currency.value,
      accountId: accountId.value,
      startDate: entryDate,
      amountMinor,
      rule:
        when.value === 'monthEnd'
          ? { kind: 'monthEnd' }
          : { kind: 'dayOfMonth', dayOfMonth: Number(day.value) || 1 },
    };
    return { kind: 'obligation', value };
  }
  const value: NewOneOffEvent = {
    name: entryName,
    category: oneOffCategory.value,
    currency: currency.value,
    accountId: accountId.value,
    date: entryDate,
    amountMinor,
    direction: side.value,
  };
  return { kind: 'oneOff', value };
}

// Debounced preview: buildProjection is cheap and pure, so the debounce is
// purely to avoid recomputing on every keystroke, not because it's slow.
let previewTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [
    amount,
    side,
    recurring,
    planned,
    when,
    day,
    cadence,
    cap,
    obligationCategory,
    oneOffCategory,
    date,
    accountId,
    currency,
    confidence,
  ],
  () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      const amountMinor = parsedAmountMinor();
      dryRun.preview(amountMinor ? buildDraft(amountMinor) : null);
    }, 150);
  }
);

const effectText = computed(() => {
  const effect = dryRun.effect.value;
  if (!effect) return null;
  const deltaText =
    effect.todayDeltaMinor === 0
      ? 'no change today'
      : `${effect.todayDeltaMinor > 0 ? '+' : ''}${formatMoney(effect.todayDeltaMinor, currency.value)} today`;
  const troughText = effect.troughChanged
    ? effect.troughAfter
      ? `low point ${formatMoney(effect.troughAfter.minBalanceMinor, currency.value)} on ${formatFullDate(effect.troughAfter.minBalanceDate)}`
      : 'low point changes'
    : 'low point unchanged';
  return `${deltaText} · ${troughText}`;
});

function handleClose(): void {
  emit('close');
}

async function onSave(): Promise<void> {
  saveError.value = null;
  const amountMinor = parsedAmountMinor();
  if (amountMinor === null) {
    saveError.value =
      firstIssueMessage(positiveAmountSchema.safeParse(amount.value)) ?? 'Enter a valid amount.';
    return;
  }
  if (!accountId.value) {
    saveError.value = 'Choose an account.';
    return;
  }
  saving.value = true;
  try {
    const draft = buildDraft(amountMinor);
    if (draft.kind === 'incomeStream') await incomeStreams.add(draft.value);
    else if (draft.kind === 'obligation') await obligations.add(draft.value);
    else if (draft.kind === 'plannedSpend') await plannedSpend.add(draft.value);
    else await oneOffEvents.add(draft.value);

    toast.success('Saved.');
    resetTransient();
    await dryRun.loadBaseline();
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseSheet :open="open" labelled-by="entry-sheet-heading" @close="handleClose">
    <div class="entry-sheet">
      <h2 id="entry-sheet-heading" class="sr-only">Add money</h2>

      <div class="side-toggle" role="group" aria-label="In or out">
        <button
          type="button"
          class="seg"
          :class="{ active: side === 'in' }"
          :aria-pressed="side === 'in'"
          @click="side = 'in'"
        >
          In
        </button>
        <button
          type="button"
          class="seg"
          :class="{ active: side === 'out' }"
          :aria-pressed="side === 'out'"
          @click="side = 'out'"
        >
          Out
        </button>
      </div>

      <BaseField label="Amount" v-slot="{ id }">
        <BaseInput
          :id="id"
          v-model="amount"
          type="number"
          data-autofocus
          class="amount-input"
          :step="exponentFor(currency) > 0 ? '0.01' : '1'"
        />
      </BaseField>

      <div class="chips">
        <button
          v-if="side === 'out'"
          type="button"
          class="chip"
          :class="{ active: recurring }"
          @click="toggleChip('recurring')"
        >
          {{ recurring ? 'Recurring' : 'One-time' }}
        </button>
        <button
          v-if="side === 'in'"
          type="button"
          class="chip"
          :class="{ active: recurring }"
          @click="toggleChip('recurring')"
        >
          {{ recurring ? 'Recurring' : 'One-time' }}
        </button>
        <button
          v-if="side === 'out'"
          type="button"
          class="chip"
          :class="{ active: planned }"
          @click="toggleChip('planned')"
        >
          {{ planned ? 'Planned spend' : 'Not planned' }}
        </button>
        <button
          v-if="side === 'out' && !planned"
          type="button"
          class="chip"
          @click="toggleChip('category')"
        >
          {{
            recurring
              ? OBLIGATION_CATEGORY_LABELS[obligationCategory]
              : ONE_OFF_CATEGORY_LABELS[oneOffCategory]
          }}
        </button>
        <button type="button" class="chip" @click="toggleChip('date')">
          {{ date === todayKey() ? 'Today' : formatFullDate(date) }}
        </button>
        <button type="button" class="chip" @click="toggleChip('account')">
          {{ accounts.find((a) => a.id === accountId)?.name ?? 'Account' }}
        </button>
        <button v-if="side === 'in'" type="button" class="chip" @click="toggleChip('confidence')">
          {{ confidence }}
        </button>
        <button type="button" class="chip" @click="toggleChip('name')">
          {{ name || 'Name' }}
        </button>
      </div>

      <div v-if="expandedChip === 'recurring'" class="chip-panel">
        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="recurring"
            @change="setRecurring(($event.target as HTMLInputElement).checked)"
          />
          Recurring
        </label>
        <div v-if="recurring && side === 'out'" class="grid">
          <BaseField label="When" v-slot="{ id }">
            <BaseSelect :id="id" v-model="when">
              <option value="dayOfMonth">Day of month</option>
              <option value="monthEnd">End of month</option>
            </BaseSelect>
          </BaseField>
          <BaseField v-if="when === 'dayOfMonth'" label="Day" v-slot="{ id }">
            <BaseInput :id="id" v-model="day" type="number" min="1" max="31" step="1" />
          </BaseField>
        </div>
      </div>

      <div v-if="expandedChip === 'planned'" class="chip-panel">
        <label class="toggle-row">
          <input
            type="checkbox"
            :checked="planned"
            @change="setPlanned(($event.target as HTMLInputElement).checked)"
          />
          Planned spend
        </label>
        <div v-if="planned" class="grid">
          <BaseField label="Cadence" v-slot="{ id }">
            <BaseSelect :id="id" v-model="cadence">
              <option v-for="c in CHARGE_CADENCES" :key="c" :value="c">{{ c }}</option>
            </BaseSelect>
          </BaseField>
          <BaseField label="Cap (optional)" v-slot="{ id }">
            <BaseInput :id="id" v-model="cap" type="number" step="0.01" />
          </BaseField>
        </div>
      </div>

      <div v-if="expandedChip === 'category'" class="chip-panel">
        <BaseField v-if="recurring" label="Category" v-slot="{ id }">
          <BaseSelect :id="id" v-model="obligationCategory">
            <option v-for="(label, c) in OBLIGATION_CATEGORY_LABELS" :key="c" :value="c">
              {{ label }}
            </option>
          </BaseSelect>
        </BaseField>
        <BaseField v-else label="Category" v-slot="{ id }">
          <BaseSelect :id="id" v-model="oneOffCategory">
            <option v-for="(label, c) in ONE_OFF_CATEGORY_LABELS" :key="c" :value="c">
              {{ label }}
            </option>
          </BaseSelect>
        </BaseField>
      </div>

      <div v-if="expandedChip === 'date'" class="chip-panel">
        <BaseField label="Date" v-slot="{ id }">
          <BaseInput :id="id" v-model="date" type="date" />
        </BaseField>
      </div>

      <div v-if="expandedChip === 'account'" class="chip-panel">
        <BaseField label="Account" v-slot="{ id }">
          <BaseSelect :id="id" v-model="accountId">
            <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </BaseSelect>
        </BaseField>
      </div>

      <div v-if="expandedChip === 'confidence'" class="chip-panel">
        <BaseField label="Confidence" v-slot="{ id }">
          <BaseSelect :id="id" v-model="confidence">
            <option value="confirmed">Confirmed</option>
            <option value="expected">Expected</option>
            <option value="uncertain">Uncertain</option>
          </BaseSelect>
        </BaseField>
      </div>

      <div v-if="expandedChip === 'name'" class="chip-panel">
        <BaseField label="Name" v-slot="{ id }">
          <BaseInput :id="id" v-model="name" type="text" placeholder="What's this for?" />
        </BaseField>
      </div>

      <p v-if="effectText" class="effect">{{ effectText }}</p>

      <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>

      <div class="actions">
        <BaseButton type="button" variant="secondary" :disabled="saving" @click="handleClose">
          Done
        </BaseButton>
        <BaseButton type="button" :disabled="saving" @click="onSave">
          {{ saving ? 'Saving…' : 'Save · keep adding' }}
        </BaseButton>
      </div>
    </div>
  </BaseSheet>
</template>

<style scoped>
.entry-sheet {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.side-toggle {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  background: var(--kapa-neutral-200);
  border-radius: 999px;
}

.seg {
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--kapa-ink-muted);
  background: transparent;
  border: 0;
  border-radius: 999px;
  min-height: 44px;
  cursor: pointer;
}

.seg.active {
  color: var(--kapa-ink);
  font-weight: 700;
  background: var(--kapa-surface);
  box-shadow: 0 1px 3px rgba(46, 43, 37, 0.14);
}

.amount-input {
  min-height: 56px;
  font-size: 1.5rem;
  font-weight: 700;
  border-color: var(--kapa-accent);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
}

.chip {
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--kapa-ink);
  background: var(--kapa-neutral-200);
  border: 0;
  border-radius: 999px;
  padding: var(--kapa-space-2) var(--kapa-space-3);
  min-height: 44px;
  cursor: pointer;
}

.chip.active {
  background: var(--kapa-accent-100);
  color: var(--kapa-accent-800);
}

.chip-panel {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
  padding: var(--kapa-space-3);
  background: var(--kapa-bg);
  border-radius: var(--kapa-radius-sm);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
  font-weight: 600;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--kapa-space-3);
}

.effect {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--kapa-space-2);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
