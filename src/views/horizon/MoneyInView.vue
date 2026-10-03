<script setup lang="ts">
import { type Currency, type CurrencyBucket } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import IncomeStreamForm from '@/components/horizon/IncomeStreamForm.vue';
import RowEditor, { type RowEditorEntry } from '@/components/horizon/RowEditor.vue';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useConvertedAmount } from '@/composables/useConvertedAmount';
import { useEntrySheet } from '@/composables/useEntrySheet';
import {
  streamKindLabel,
  useIncomeStreams,
  type IncomeStreamMonth,
} from '@/composables/useIncomeStreams';
import { useToast } from '@/composables/useToast';
import { formatMoney, formatRate } from '@/lib/money';
import { formatFullDate, formatFullMonth } from '@/lib/date';
import { useSpaceStore } from '@/stores/space';

const props = withDefaults(defineProps<{ isDesktop?: boolean }>(), { isDesktop: false });

const space = useSpaceStore();
const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

const { streamsWithMonth, convertibles, month, calendar, loading, error, add, update, archive } =
  useIncomeStreams();
const { accounts } = useAccounts();
const { spaceCurrencyAmount, fxAsOf, unconvertible, rateFor } = useConvertedAmount(convertibles);

// The In/Out side is fixed here by the shell — this panel is the In side.
const monthLabel = computed(() => (month.value ? formatFullMonth(month.value) : ''));

const totalMinor = computed(() =>
  convertibles.value.reduce((sum, item) => sum + (spaceCurrencyAmount(item) ?? 0), 0)
);

const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const item of unconvertible.value) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amountMinor);
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

const fxNote = computed(() => {
  const asOf = fxAsOf();
  if (!asOf || !month.value) return '';
  return `${monthLabel.value} · converted at rates as of ${formatFullDate(asOf.date)}`;
});

// Kind filter (All/Recurring/One-off) over stream.recurrence.
type KindFilter = 'all' | 'recurring' | 'oneOff';
const kindFilter = ref<KindFilter>('all');

const KIND_OPTIONS: { key: KindFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'recurring', label: 'Recurring' },
  { key: 'oneOff', label: 'One-off' },
];

const filtered = computed<IncomeStreamMonth[]>(() => {
  if (kindFilter.value === 'all') return streamsWithMonth.value;
  return streamsWithMonth.value.filter((s) => s.recurrence === kindFilter.value);
});

const CONFIDENCE_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  expected: 'Expected',
  uncertain: 'Uncertain',
};

const RECURRENCE_LABELS: Record<string, string> = {
  recurring: 'Recurring',
  oneOff: 'One-off',
};

function confidenceVariant(confidence: string): 'confirmed' | 'expected' | 'uncertain' | 'neutral' {
  if (confidence === 'confirmed' || confidence === 'expected' || confidence === 'uncertain') {
    return confidence;
  }
  return 'neutral';
}

const toast = useToast();
const entrySheet = useEntrySheet();

const editingId = ref<string | null>(null);

function onEdited(): void {
  editingId.value = null;
  toast.success('Income updated');
}

function onCancelled(): void {
  editingId.value = null;
}

function onArchived(): void {
  editingId.value = null;
  toast.success('Income stream archived');
}

function native(stream: IncomeStreamMonth, amountMinor: number): string {
  return formatMoney(amountMinor, stream.currency as Currency);
}

// The stream's schedule description, split so the template can strike the
// slipped original (matching the artboard's `Monthly, 1st → ~~Mon 1~~ Tue 2`).
function scheduleParts(stream: IncomeStreamMonth): {
  live: string;
  original: string | null;
} {
  const first = stream.occurrences[0];
  if (!first) return { live: streamKindLabel(stream.kind), original: null };
  if (first.shifted && first.originalDate) {
    return { live: formatFullDate(first.date), original: formatFullDate(first.originalDate) };
  }
  return { live: formatFullDate(first.date), original: null };
}

// Native amount + the snapshot rate for a foreign stream whose rate we know.
// Native + "@ rate" is the honest FX surface (the snapshot date is named once
// in the fx-note above; showing the rate, not a converted figure, keeps the
// row from implying live FX); `null` when the stream is native or un-ratable.
// Fixed/variable streams get the compact RowEditor; hourly streams keep the
// full form (H6 earning-period/lag fields don't fit the compact shape).
function streamEntry(stream: IncomeStreamMonth): RowEditorEntry {
  return {
    kind: 'stream',
    initial: stream,
    calendar: calendar.value!,
    update,
    archive,
  };
}

function fxMeta(stream: IncomeStreamMonth): { native: string; rate: string } | null {
  if (stream.currency === spaceCurrency.value) return null;
  const rate = rateFor({
    id: stream.id,
    currency: stream.currency as Currency,
    amountMinor: stream.monthlyMinor,
  });
  if (rate === null) return null;
  return {
    native: formatMoney(stream.monthlyMinor, stream.currency as Currency),
    rate: formatRate(rate),
  };
}
</script>

<template>
  <main class="page page--with-rail">
    <div class="page-main">
      <div class="heading-row">
        <div class="heading-left">
          <h1>Money</h1>
          <BaseButton
            v-if="props.isDesktop"
            type="button"
            variant="secondary"
            class="add-trigger"
            @click="entrySheet.open('in')"
          >
            Add
          </BaseButton>
        </div>
        <span class="hero-amount tone-positive">{{ formatMoney(totalMinor, spaceCurrency) }}</span>
      </div>

      <p class="fx-note" v-if="fxNote">{{ fxNote }}</p>

      <div class="kind-filter" role="group" aria-label="Filter by kind">
        <button
          v-for="opt in KIND_OPTIONS"
          :key="opt.key"
          type="button"
          class="seg"
          :class="{ active: kindFilter === opt.key }"
          :aria-pressed="kindFilter === opt.key"
          @click="kindFilter = opt.key"
        >
          {{ opt.label }}
        </button>
      </div>

      <template v-if="loading && !streamsWithMonth.length">
        <SkeletonBlock height="42px" />
        <SkeletonBlock height="42px" />
      </template>

      <p v-else-if="error" role="alert" class="error">{{ error }}</p>

      <template v-else>
        <EmptyState
          v-if="!filtered.length"
          title="No income streams"
          message="Add the money that comes in and see what each month is worth."
        />

        <ul v-else class="list">
          <li
            v-for="stream in filtered"
            :key="stream.id"
            class="row"
            :class="{ editing: editingId === stream.id }"
          >
            <template v-if="editingId === stream.id">
              <RowEditor
                v-if="stream.kind !== 'hourly'"
                class="edit-form"
                :entry="streamEntry(stream)"
                @saved="onEdited"
                @archived="onArchived"
                @cancelled="onCancelled"
              />
              <IncomeStreamForm
                v-else
                class="edit-form"
                :accounts="accounts.filter((a) => !a.archived)"
                :space-currency="spaceCurrency"
                :default-start-date="month ? `${month}-01` : ''"
                :calendar="calendar!"
                :initial="stream"
                :save="add"
                :update="update"
                :archive="archive"
                @saved="onEdited"
                @archived="onArchived"
                @cancelled="onCancelled"
              />
            </template>
            <template v-else>
              <button type="button" class="row-main" @click="editingId = stream.id">
                <span class="glyph tone-positive">
                  <svg width="22" height="22" viewBox="0 0 22 22">
                    <circle cx="11" cy="11" r="7" />
                  </svg>
                </span>
                <span class="row-info">
                  <span class="row-name">{{ stream.name }}</span>
                  <span class="meta">
                    <span class="badges">
                      <BaseBadge>{{ streamKindLabel(stream.kind) }}</BaseBadge>
                      <BaseBadge
                        v-if="CONFIDENCE_LABELS[stream.confidence]"
                        :variant="confidenceVariant(stream.confidence)"
                      >
                        {{ CONFIDENCE_LABELS[stream.confidence] }}
                      </BaseBadge>
                      <BaseBadge v-if="RECURRENCE_LABELS[stream.recurrence]">
                        {{ RECURRENCE_LABELS[stream.recurrence] }}
                      </BaseBadge>
                    </span>
                    <span v-if="scheduleParts(stream).live" class="schedule">
                      <template v-if="scheduleParts(stream).original">
                        <s>{{ scheduleParts(stream).original }}</s>
                      </template>
                      {{ scheduleParts(stream).live }}
                    </span>
                  </span>
                </span>
                <span class="row-total">
                  <span class="native">{{ native(stream, stream.monthlyMinor) }}</span>
                  <span v-if="fxMeta(stream)" class="fx">
                    {{ fxMeta(stream)!.native }} @ {{ fxMeta(stream)!.rate }}
                  </span>
                </span>
              </button>
            </template>
          </li>
        </ul>
      </template>
    </div>

    <aside v-if="props.isDesktop" class="page-side">
      <BaseCard class="side-card">
        <h2 class="side-heading">Counted in {{ monthLabel }}</h2>
        <p class="side-total tone-positive">{{ formatMoney(totalMinor, spaceCurrency) }}</p>
        <UnconvertedNote
          :buckets="unconvertibleBuckets"
          :currency="spaceCurrency"
          context="in this month\u2019s income"
        />
      </BaseCard>
    </aside>
  </main>
</template>

<style scoped>
.heading-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  margin-bottom: var(--kapa-space-2);
}

.heading-row h1 {
  margin: 0;
}

.heading-left {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-3);
}

.hero-amount {
  font-family: var(--font-heading);
  font-size: 24px;
  color: var(--kapa-ink);
}

.tone-positive {
  color: var(--kapa-positive);
}

.fx-note {
  margin: 0 0 var(--kapa-space-4);
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.kind-filter {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--kapa-space-5);
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
  transition:
    color var(--kapa-motion-fast) var(--kapa-motion-ease),
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    box-shadow var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.seg.active {
  color: var(--kapa-ink);
  font-weight: 700;
  background: var(--kapa-surface);
  box-shadow: 0 1px 3px rgba(46, 43, 37, 0.14);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row {
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: 18px;
}

.row.editing {
  border-color: transparent;
  background: transparent;
}

.row-main {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  gap: var(--kapa-space-3);
  align-items: center;
  width: 100%;
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: none;
  border: 0;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: 18px;
}

.row-main:focus-visible {
  outline: 2px solid var(--kapa-accent);
  outline-offset: -2px;
}

.glyph {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--kapa-positive);
}

.glyph svg {
  fill: currentColor;
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
  min-width: 0;
}

.row-name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.meta {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: var(--kapa-space-1);
}

.schedule {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.schedule s {
  margin-right: 0.35em;
  color: var(--kapa-ink-muted);
}

.row-total {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  color: var(--kapa-ink);
  font-weight: 600;
  text-align: right;
}

.fx {
  font-size: var(--kapa-text-caption-size);
  font-weight: 400;
  color: var(--kapa-ink-muted);
}

.edit-form {
  margin: 0;
}

.side-card {
  padding: var(--kapa-space-4);
}

.side-heading {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--kapa-ink-muted);
  margin: 0 0 var(--kapa-space-2);
}

.side-total {
  font-family: var(--font-heading);
  font-size: 28px;
  margin: 0 0 var(--kapa-space-2);
}
</style>
