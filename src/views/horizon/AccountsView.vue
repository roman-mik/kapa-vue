<script setup lang="ts">
import { CURRENCIES, CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import AccountChips from '@/components/horizon/AccountChips.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';
import { accountNameSchema, firstIssueMessage, signedAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';

// Must match horizon.accounts' `type` check constraint in kapa-core
// (kapa-core/supabase/migrations/20260823223247_horizon_schema.sql).
const ACCOUNT_TYPES = [
  { value: 'personal', label: 'Personal' },
  { value: 'business', label: 'Business' },
  { value: 'savings', label: 'Savings' },
] as const;

const space = useSpaceStore();
const { accounts, loading, error, add, update, archive, totalMinor, totalCurrency } = useAccounts();

const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

const editingId = ref<string | null>(null);
const name = ref('');
const currency = ref<Currency>('RSD');
const balance = ref('');
const type = ref<string>('bank');
const includeInTotal = ref(true);
const saving = ref(false);
const saveError = ref<string | null>(null);

function resetForm(): void {
  editingId.value = null;
  name.value = '';
  currency.value = spaceCurrency.value;
  balance.value = '';
  type.value = 'bank';
  includeInTotal.value = true;
  saveError.value = null;
}

watch(spaceCurrency, (c) => {
  if (!editingId.value) currency.value = c;
});

function startEdit(accountId: string): void {
  const account = accounts.value.find((a) => a.id === accountId);
  if (!account) return;
  editingId.value = account.id;
  name.value = account.name;
  currency.value = account.currency as Currency;
  balance.value = String(account.current_balance_minor / 10 ** CURRENCY_EXPONENT[currency.value]);
  type.value = account.type;
  includeInTotal.value = account.include_in_total;
  saveError.value = null;
}

const toast = useToast();

async function onSubmit(): Promise<void> {
  saveError.value = null;
  const parsedName = accountNameSchema.safeParse(name.value);
  if (!parsedName.success) {
    saveError.value = firstIssueMessage(parsedName) ?? 'Enter a name.';
    return;
  }
  const parsedBalance = signedAmountSchema.safeParse(balance.value);
  if (!parsedBalance.success) {
    saveError.value = firstIssueMessage(parsedBalance) ?? 'Enter a valid amount.';
    return;
  }

  saving.value = true;
  try {
    const balanceMinor = Math.round(parsedBalance.data * 10 ** CURRENCY_EXPONENT[currency.value]);
    if (editingId.value) {
      const outcome = await update(
        editingId.value,
        {
          name: parsedName.data,
          currency: currency.value,
          current_balance_minor: balanceMinor,
          type: type.value,
          include_in_total: includeInTotal.value,
        },
        accounts.value.find((a) => a.id === editingId.value)!.updated_at
      );
      if (!outcome.ok) {
        saveError.value = 'This account changed elsewhere. Reload to see the latest.';
        toast.error('Couldn\u2019t save \u2014 it changed elsewhere.');
        return;
      }
      toast.success('Account saved');
    } else {
      await add({
        name: parsedName.data,
        currency: currency.value,
        balanceMinor,
        type: type.value,
        includeInTotal: includeInTotal.value,
      });
      toast.success('Account added');
    }
    resetForm();
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : "Couldn't save the account.";
    toast.error(saveError.value);
  } finally {
    saving.value = false;
  }
}

async function onArchive(accountId: string): Promise<void> {
  const account = accounts.value.find((a) => a.id === accountId);
  if (!account) return;
  if (!window.confirm(`Archive "${account.name}"? It will stop counting toward totals.`)) return;
  const outcome = await archive(accountId, account.updated_at);
  if (outcome.ok) {
    toast.success('Account archived');
    if (editingId.value === accountId) resetForm();
  } else {
    toast.error('Couldn\u2019t archive \u2014 it changed elsewhere.');
  }
}
</script>

<template>
  <main class="page">
    <h1>Accounts</h1>

    <div class="hero">
      <span class="hero-label">Total balance</span>
      <span class="hero-amount">{{ formatMoney(totalMinor, totalCurrency) }}</span>
    </div>

    <template v-if="loading && !accounts.length">
      <SkeletonBlock height="42px" />
      <SkeletonBlock height="42px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <AccountChips v-if="accounts.length" :accounts="accounts" />
      <EmptyState
        v-else
        title="No accounts yet"
        message="Add an account to start your Horizon projection."
      />

      <BaseCard class="form-card">
        <h2>{{ editingId ? 'Edit account' : 'Add account' }}</h2>
        <form class="form" @submit.prevent="onSubmit">
          <div class="grid">
            <BaseField label="Name" v-slot="{ id }">
              <BaseInput :id="id" v-model="name" required />
            </BaseField>

            <BaseField label="Currency" v-slot="{ id }">
              <BaseSelect :id="id" v-model="currency">
                <option v-for="c in CURRENCIES" :key="c" :value="c">{{ c }}</option>
              </BaseSelect>
            </BaseField>
          </div>

          <div class="grid">
            <BaseField label="Current balance" v-slot="{ id }">
              <BaseInput
                :id="id"
                v-model="balance"
                type="number"
                :step="CURRENCY_EXPONENT[currency] > 0 ? '0.01' : '1'"
              />
            </BaseField>

            <BaseField label="Type" v-slot="{ id }">
              <BaseSelect :id="id" v-model="type">
                <option v-for="t in ACCOUNT_TYPES" :key="t.value" :value="t.value">
                  {{ t.label }}
                </option>
              </BaseSelect>
            </BaseField>
          </div>

          <BaseCheckbox v-model="includeInTotal" label="Count toward the total" />

          <div class="actions">
            <BaseButton v-if="editingId" type="button" variant="ghost" @click="resetForm">
              Cancel
            </BaseButton>
            <BaseButton type="submit" :disabled="saving">
              {{ saving ? 'Saving…' : editingId ? 'Save changes' : 'Add account' }}
            </BaseButton>
          </div>
          <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>
        </form>
      </BaseCard>

      <ul v-if="accounts.length" class="list">
        <li v-for="account in accounts" :key="account.id" class="row">
          <div class="row-info">
            <span class="row-name">{{ account.name }}</span>
            <span
              v-if="!account.include_in_total || account.currency !== spaceCurrency"
              class="note"
            >
              not in total
            </span>
          </div>
          <span class="row-balance">{{
            formatMoney(account.current_balance_minor, account.currency as Currency)
          }}</span>
          <div class="row-actions">
            <BaseButton variant="ghost" @click="startEdit(account.id)">Edit</BaseButton>
            <BaseButton variant="ghost" @click="onArchive(account.id)">Archive</BaseButton>
          </div>
        </li>
      </ul>
    </template>
  </main>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
  margin-bottom: var(--kapa-space-5);
}

.hero-label {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-amount {
  font-family: var(--font-heading);
  font-size: var(--kapa-text-display-size);
  color: var(--kapa-ink);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

.form-card {
  margin: var(--kapa-space-5) 0;
}

.form-card h2 {
  margin-bottom: var(--kapa-space-4);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--kapa-space-3);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--kapa-space-2);
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
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-3);
  padding: var(--kapa-space-3) var(--kapa-space-4);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
}

.row-info {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.row-name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.note {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.row-balance {
  margin-left: auto;
  color: var(--kapa-ink);
  font-weight: 600;
}

.row-actions {
  display: flex;
  gap: var(--kapa-space-1);
}
</style>
