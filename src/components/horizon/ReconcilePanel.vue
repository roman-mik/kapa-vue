<script setup lang="ts">
import { CURRENCY_EXPONENT, type Currency } from '@roman-mik/kapa-core/pocket';
import type { Account } from '@roman-mik/kapa-core/horizon/queries';
import { ref } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { useReconcile } from '@/composables/useReconcile';
import { useToast } from '@/composables/useToast';
import { formatMoney } from '@/lib/money';

const props = defineProps<{
  accounts: Account[];
}>();

const emit = defineEmits<{
  saved: [];
}>();

const open = ref(false);
const toast = useToast();
const { saving, activeAccounts, draftFor, varianceFor, save, logAsOneOff, saveError } =
  useReconcile(
    // The panel only ever shows active accounts; a computed over the prop's
    // source keeps the composable consistent with the list.
    () => props.accounts as Account[],
    async () => emit('saved')
  );

async function onSave(): Promise<void> {
  const ok = await save();
  if (ok) {
    toast.success('Balances reconciled');
    open.value = false;
  } else if (saveError.value) {
    toast.error(saveError.value);
  }
}

async function onLogAsOneOff(account: Account): Promise<void> {
  const ok = await logAsOneOff(account);
  if (ok) {
    toast.success('Variance logged as a one-off');
  } else if (saveError.value) {
    toast.error(saveError.value);
  }
}

function varianceClass(variance: number): string {
  return variance > 0 ? 'variance-positive' : variance < 0 ? 'variance-negative' : 'variance-zero';
}

function variancePrefix(variance: number): string {
  return variance > 0 ? '+' : '';
}
</script>

<template>
  <div>
    <BaseButton v-if="!open" variant="secondary" block @click="open = true">
      Reconcile balances
    </BaseButton>

    <BaseCard v-else class="panel">
      <div class="panel-head">
        <h2>Reconcile balances</h2>
        <p class="hint">Enter the actual balance from your bank to see where the model drifted.</p>
      </div>

      <div v-if="activeAccounts().length === 0" class="hint">No accounts to reconcile yet.</div>

      <div v-else class="rows">
        <div v-for="account in activeAccounts()" :key="account.id" class="row">
          <div class="row-head">
            <span class="row-name">{{ account.name }}</span>
            <span class="row-expected">
              Projected:
              {{ formatMoney(account.current_balance_minor, account.currency as Currency) }}
            </span>
          </div>

          <div class="row-grid">
            <BaseField label="Actual balance">
              <BaseInput
                v-model="draftFor(account).actual"
                type="number"
                :step="CURRENCY_EXPONENT[account.currency as Currency] > 0 ? '0.01' : '1'"
              />
            </BaseField>

            <div class="variance-block">
              <span class="var-label">Variance</span>
              <span class="variance" :class="varianceClass(varianceFor(account))">
                {{ variancePrefix(varianceFor(account))
                }}{{ formatMoney(varianceFor(account), account.currency as Currency) }}
              </span>
            </div>
          </div>

          <BaseField label="Note (optional)">
            <BaseInput
              v-model="draftFor(account).note"
              placeholder="Why did it drift?"
              maxlength="500"
            />
          </BaseField>

          <div v-if="varianceFor(account) !== 0" class="row-actions">
            <span class="row-actions-hint">
              Variance of
              {{ formatMoney(Math.abs(varianceFor(account)), account.currency as Currency) }}
            </span>
            <BaseButton
              variant="ghost"
              :disabled="saveError != null || saving"
              @click="onLogAsOneOff(account)"
            >
              Log as one-off
            </BaseButton>
          </div>
        </div>
      </div>

      <p v-if="saveError" role="alert" class="error">{{ saveError }}</p>

      <div class="panel-actions">
        <BaseButton type="button" variant="ghost" @click="open = false"> Cancel </BaseButton>
        <BaseButton type="button" :disabled="saveError != null || saving" @click="onSave">
          {{ saving ? 'Saving…' : 'Save reconciliation' }}
        </BaseButton>
      </div>
    </BaseCard>
  </div>
</template>

<style scoped>
.panel {
  padding: var(--kapa-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.panel-head h2 {
  margin: 0 0 var(--kapa-space-1);
  font-family: var(--font-heading);
  font-size: var(--kapa-text-lg-size);
  color: var(--kapa-ink);
}

.hint {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.row {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
  padding-bottom: var(--kapa-space-4);
  border-bottom: 1px solid var(--kapa-neutral-200);
}

.row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.row-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--kapa-space-3);
}

.row-name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.row-expected,
.var-label {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.row-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--kapa-space-3);
}

.variance-block {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.variance {
  display: inline-flex;
  align-items: center;
  min-height: calc(var(--kapa-space-3) * 2 + var(--kapa-text-md-size));
  padding: 0 var(--kapa-space-3);
  border-radius: var(--kapa-radius-sm);
  font-weight: 600;
}

.variance-positive {
  color: var(--kapa-positive-700);
  background: var(--kapa-positive-100);
}

.variance-negative {
  color: var(--kapa-negative);
  background: var(--kapa-negative-100);
}

.variance-zero {
  color: var(--kapa-ink-muted);
  background: var(--kapa-neutral-200);
}

.row-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--kapa-space-3);
}

.row-actions-hint {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--kapa-space-2);
}
</style>
