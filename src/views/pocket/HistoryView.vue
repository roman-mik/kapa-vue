<script setup lang="ts">
import {
  attributionLabel,
  CURRENCY_EXPONENT,
  type Currency,
  dayLabel,
  zonedDateKey,
} from '@roman-mik/kapa-core/pocket';
import type { ExpenseView } from '@roman-mik/kapa-core/pocket/queries';
import { computed, ref } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useExpenses } from '@/composables/useExpenses';
import { useSpaceMembers } from '@/composables/useSpaceMembers';
import { useToast } from '@/composables/useToast';
import { useSessionStore } from '@/stores/session';
import { useSpaceStore } from '@/stores/space';
import { formatMoney } from '@/lib/money';

const { expenses, loading, error, update, remove } = useExpenses();
const { members } = useSpaceMembers();
const space = useSpaceStore();
const toast = useToast();
const session = useSessionStore();

const editingId = ref<string | null>(null);
const editAmount = ref('');
const editNote = ref('');
const busyId = ref<string | null>(null);
const rowError = ref<string | null>(null);

function attribution(userId: string | null): string {
  const currentUserId = session.user?.id ?? '';
  const member = members.value.find((m) => m.userId === userId);
  return attributionLabel(
    userId,
    currentUserId,
    member ? { displayName: member.displayName } : undefined,
    {
      you: 'You',
      spaceMember: 'Space member',
      formerMember: 'Former member',
    }
  );
}

function startEdit(
  id: string,
  amountMinor: number | null,
  currency: string | null,
  note: string | null
): void {
  editingId.value = id;
  const exponent = CURRENCY_EXPONENT[(currency ?? 'RSD') as Currency];
  editAmount.value = amountMinor !== null ? String(amountMinor / 10 ** exponent) : '';
  editNote.value = note ?? '';
}

async function confirmEdit(id: string, currency: string | null): Promise<void> {
  rowError.value = null;
  const value = Number(editAmount.value);
  if (!Number.isFinite(value) || value <= 0) {
    rowError.value = 'Enter a valid amount.';
    return;
  }
  const exponent = CURRENCY_EXPONENT[(currency ?? 'RSD') as Currency];
  busyId.value = id;
  try {
    await update(id, {
      amount_minor: Math.round(value * 10 ** exponent),
      note: editNote.value.trim() || null,
    });
    editingId.value = null;
    toast.success('Expense updated');
  } catch (err) {
    rowError.value = err instanceof Error ? err.message : "Couldn't save that expense.";
    toast.error(rowError.value);
  } finally {
    busyId.value = null;
  }
}

async function onDelete(id: string): Promise<void> {
  busyId.value = id;
  rowError.value = null;
  try {
    await remove(id);
    toast.success('Expense deleted');
  } catch (err) {
    rowError.value = err instanceof Error ? err.message : "Couldn't delete that expense.";
    toast.error(rowError.value);
  } finally {
    busyId.value = null;
  }
}

const rows = computed(() => expenses.value);

interface DayGroup {
  dateKey: string;
  heading: string;
  rows: ExpenseView[];
  total: number | null;
  currency: Currency | null;
}

// 'YYYY-MM-DD' parsed and reformatted via an explicit UTC anchor — the key
// is a calendar date with no attached timezone, so letting the browser's
// local zone interpret it could shift the displayed day.
function formatDateHeading(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

const dayGroups = computed<DayGroup[]>(() => {
  const timeZone = space.currentSpace?.timezone;
  if (!timeZone) return [];

  const byDay = new Map<string, ExpenseView[]>();
  for (const row of rows.value) {
    if (!row.spent_at) continue;
    const dateKey = zonedDateKey(new Date(row.spent_at), timeZone);
    (byDay.get(dateKey) ?? byDay.set(dateKey, []).get(dateKey)!).push(row);
  }

  const now = new Date();
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dateKey, dayRows]) => {
      const label = dayLabel(dateKey, now, timeZone);
      const currencies = new Set(dayRows.map((r) => (r.currency ?? 'RSD') as Currency));
      const singleCurrency = currencies.size === 1 ? [...currencies][0] : null;
      return {
        dateKey,
        heading:
          label === 'today'
            ? 'Today'
            : label === 'yesterday'
              ? 'Yesterday'
              : formatDateHeading(dateKey),
        rows: dayRows,
        currency: singleCurrency,
        total: singleCurrency ? dayRows.reduce((sum, r) => sum + (r.amount_minor ?? 0), 0) : null,
      };
    });
});
</script>

<template>
  <main class="page">
    <h1>History</h1>

    <template v-if="loading && !rows.length">
      <SkeletonBlock height="64px" />
      <SkeletonBlock height="64px" />
      <SkeletonBlock height="64px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>
    <EmptyState v-else-if="!rows.length" title="No expenses yet" />

    <template v-else>
      <section v-for="group in dayGroups" :key="group.dateKey" class="day-group">
        <div class="day-heading">
          <h2>{{ group.heading }}</h2>
          <span v-if="group.total !== null && group.currency" class="day-total">
            {{ formatMoney(group.total, group.currency) }}
          </span>
        </div>

        <ul class="list">
          <li v-for="row in group.rows" :key="row.id ?? ''">
            <template v-if="editingId === row.id">
              <BaseInput v-model="editAmount" type="number" min="0" step="0.01" />
              <BaseInput v-model="editNote" type="text" placeholder="Note" />
              <BaseButton
                variant="secondary"
                :disabled="busyId === row.id"
                @click="confirmEdit(row.id!, row.currency)"
              >
                Save
              </BaseButton>
              <BaseButton variant="ghost" @click="editingId = null">Cancel</BaseButton>
            </template>
            <template v-else>
              <div class="main">
                <span class="amount">{{
                  formatMoney(row.amount_minor ?? 0, (row.currency ?? 'RSD') as Currency)
                }}</span>
                <span class="category">{{ row.category_name ?? 'Uncategorized' }}</span>
                <span class="attribution">{{ attribution(row.user_id) }}</span>
              </div>
              <p v-if="row.note" class="note">{{ row.note }}</p>
              <div class="actions">
                <BaseButton
                  variant="ghost"
                  @click="startEdit(row.id!, row.amount_minor, row.currency, row.note)"
                >
                  Edit
                </BaseButton>
                <ConfirmButton
                  label="Delete"
                  confirm-label="Really delete?"
                  :disabled="busyId === row.id"
                  @confirm="onDelete(row.id!)"
                />
              </div>
            </template>
          </li>
        </ul>
      </section>
    </template>
    <p v-if="rowError" role="alert" class="error">{{ rowError }}</p>
  </main>
</template>

<style scoped>
.day-group + .day-group {
  margin-top: var(--kapa-space-5);
}

.day-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--kapa-space-2);
}

.day-heading h2 {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.day-total {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.list li {
  padding: var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
}

.main {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-2);
}

.amount {
  font-weight: 600;
}

.category {
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.attribution {
  margin-left: auto;
  color: var(--kapa-ink-subtle);
  font-size: var(--kapa-text-caption-size);
}

.note {
  margin: var(--kapa-space-1) 0 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.actions {
  display: flex;
  gap: var(--kapa-space-2);
  margin-top: var(--kapa-space-2);
}

.error {
  color: var(--kapa-negative);
}
</style>
