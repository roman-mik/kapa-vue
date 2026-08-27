<script setup lang="ts">
import { attributionLabel } from '@roman-mik/kapa-core/pocket';
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import { useExpenses } from '@/composables/useExpenses';
import { useSpaceMembers } from '@/composables/useSpaceMembers';
import { useSessionStore } from '@/stores/session';
import { formatMoney } from '@/lib/money';

const { expenses, loading, error, update, remove } = useExpenses();
const { members } = useSpaceMembers();
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
  } catch (err) {
    rowError.value = err instanceof Error ? err.message : "Couldn't save that expense.";
  } finally {
    busyId.value = null;
  }
}

async function onDelete(id: string): Promise<void> {
  busyId.value = id;
  try {
    await remove(id);
  } finally {
    busyId.value = null;
  }
}

const rows = computed(() => expenses.value);
</script>

<template>
  <main class="history">
    <h1>History</h1>
    <p v-if="loading && !rows.length">Loading…</p>
    <p v-else-if="error" role="alert" class="error">{{ error }}</p>
    <p v-else-if="!rows.length">No expenses yet.</p>

    <ul v-else class="list">
      <li v-for="row in rows" :key="row.id ?? ''">
        <template v-if="editingId === row.id">
          <input v-model="editAmount" type="number" min="0" step="0.01" />
          <input v-model="editNote" type="text" placeholder="Note" />
          <button
            type="button"
            :disabled="busyId === row.id"
            @click="confirmEdit(row.id!, row.currency)"
          >
            Save
          </button>
          <button type="button" @click="editingId = null">Cancel</button>
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
            <button
              type="button"
              @click="startEdit(row.id!, row.amount_minor, row.currency, row.note)"
            >
              Edit
            </button>
            <button type="button" :disabled="busyId === row.id" @click="onDelete(row.id!)">
              Delete
            </button>
          </div>
        </template>
      </li>
    </ul>
    <p v-if="rowError" role="alert" class="error">{{ rowError }}</p>
  </main>
</template>

<style scoped>
.history {
  max-width: 480px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.list li {
  padding: 0.75rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
}

.main {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.amount {
  font-weight: 600;
}

.category {
  color: var(--kapa-ink-muted);
  font-size: 0.85rem;
}

.attribution {
  margin-left: auto;
  color: var(--kapa-ink-subtle);
  font-size: 0.8rem;
}

.note {
  margin: 0.25rem 0 0;
  color: var(--kapa-ink-muted);
  font-size: 0.85rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.actions button,
.list input {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: transparent;
  color: var(--kapa-ink);
  cursor: pointer;
}

.list input {
  cursor: text;
  background: var(--kapa-bg);
}

.error {
  color: var(--kapa-negative);
}
</style>
