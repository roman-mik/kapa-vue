<script setup lang="ts">
import { attributionLabel } from '@roman-mik/kapa-core/pocket';
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
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
  <main class="page">
    <h1>History</h1>

    <template v-if="loading && !rows.length">
      <SkeletonBlock height="64px" />
      <SkeletonBlock height="64px" />
      <SkeletonBlock height="64px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>
    <EmptyState v-else-if="!rows.length" title="No expenses yet" />

    <ul v-else class="list">
      <li v-for="row in rows" :key="row.id ?? ''">
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
            <BaseButton variant="ghost" :disabled="busyId === row.id" @click="onDelete(row.id!)">
              Delete
            </BaseButton>
          </div>
        </template>
      </li>
    </ul>
    <p v-if="rowError" role="alert" class="error">{{ rowError }}</p>
  </main>
</template>

<style scoped>
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
