<script setup lang="ts">
import {
  ACCOUNT_TYPES,
  type Account,
  type AccountType,
} from '@roman-mik/kapa-core/horizon/queries';
import {
  CURRENCIES,
  CURRENCY_EXPONENT,
  type Currency,
  type CurrencyBucket,
} from '@roman-mik/kapa-core/pocket';
import { computed, ref, watch } from 'vue';
import AccountChips from '@/components/horizon/AccountChips.vue';
import FxSnapshotPanel from '@/components/horizon/FxSnapshotPanel.vue';
import ReconcilePanel from '@/components/horizon/ReconcilePanel.vue';
import UnconvertedNote from '@/components/pocket/UnconvertedNote.vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseCheckbox from '@/components/ui/BaseCheckbox.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import BaseSelect from '@/components/ui/BaseSelect.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import BaseBadge from '@/components/ui/BaseBadge.vue';
import { useAccounts } from '@/composables/useAccounts';
import { useConvertedAmount, type Convertible } from '@/composables/useConvertedAmount';
import { useToast } from '@/composables/useToast';
import { accountShareOfTotal } from '@/lib/horizon/accountShare';
import { formatMoney } from '@/lib/money';
import { accountNameSchema, firstIssueMessage, signedAmountSchema } from '@/lib/validation';
import { useSpaceStore } from '@/stores/space';

// ACCOUNT_TYPES itself is generated from horizon.account_type (kapa-core);
// only the display labels are a UI concern and live here. The Record makes
// a future enum value a compile error here too, not a silently unlabelled
// option.
const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  bank: 'Bank account',
  cash: 'Cash',
  credit: 'Credit card',
  investment: 'Investment',
  other: 'Other',
};

const space = useSpaceStore();
const { accounts, loading, error, refresh, add, update, archive } = useAccounts();

const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);

const convertibles = computed<Convertible[]>(() => accounts.value.map(toConvertible));

function toConvertible(a: {
  id: string;
  currency: string;
  current_balance_minor: number;
}): Convertible {
  return {
    id: a.id,
    currency: a.currency as Currency,
    amountMinor: a.current_balance_minor,
  };
}

const {
  convertedMinor,
  spaceCurrencyAmount,
  unconvertible,
  rateFor,
  refresh: refreshRates,
  loading: fxLoading,
} = useConvertedAmount(convertibles);

// Distinct foreign currencies in use, ascending — FxSnapshotPanel's row set.
// `rateFor` takes a Convertible; the amount doesn't matter for a rate lookup,
// only the currency and (defaulted) as-of date, so a zero-amount stand-in works.
const foreignCurrencies = computed<Currency[]>(() =>
  [...new Set(accounts.value.map((a) => a.currency as Currency))]
    .filter((c) => c !== spaceCurrency.value)
    .sort()
);

function rateForCurrency(c: Currency) {
  return rateFor({ id: c, currency: c, amountMinor: 0 });
}

// The hero total is now conversion-aware (H3): every include_in_total account
// counts at its space-currency figure, including foreign ones converted via
// `core.fx_rates`. An un-ratable foreign account contributes nothing and is
// surfaced in the unconverted note, never silently dropped.
const includedAccounts = computed(() => accounts.value.filter((a) => a.include_in_total));
const totalMinor = computed(() =>
  includedAccounts.value.reduce((sum, a) => sum + (spaceCurrencyAmount(toConvertible(a)) ?? 0), 0)
);
const totalCurrency = computed<Currency>(() => spaceCurrency.value);

// Foreign include_in_total accounts with no covering rate, bucketed by
// currency, for the shared UnconvertedNote (same wording as Pocket).
const unconvertibleBuckets = computed<CurrencyBucket[]>(() => {
  const totals = new Map<Currency, number>();
  for (const item of unconvertible.value) {
    const acc = accounts.value.find((a) => a.id === item.id);
    if (!acc?.include_in_total) continue;
    const currency = item.currency;
    totals.set(currency, (totals.get(currency) ?? 0) + item.amountMinor);
  }
  return [...totals.entries()].map(([currency, amountMinor]) => ({ currency, amountMinor }));
});

function shareOfTotal(account: Account): number | null {
  const amount = spaceCurrencyAmount(toConvertible(account));
  return accountShareOfTotal(amount, totalMinor.value, account.include_in_total);
}

// Accounts have no stored colour column (unlike Pocket categories), so the
// dot cycles a fixed position-based swatch slot — same fallback idiom as
// HistoryView's `categorySwatch` for uncategorized entries.
function accountSwatch(position: number): string {
  return `var(--kapa-swatch-${(position % 8) + 1})`;
}

const editingId = ref<string | null>(null);
const name = ref('');
const currency = ref<Currency>('RSD');
const balance = ref('');
const type = ref<AccountType>('bank');
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
  <main class="page page--with-rail">
    <div class="page-main">
      <h1>Accounts</h1>

      <div class="hero">
        <span class="hero-label">Total balance</span>
        <span class="hero-amount">{{ formatMoney(totalMinor, totalCurrency) }}</span>
        <UnconvertedNote
          :buckets="unconvertibleBuckets"
          :currency="spaceCurrency"
          context="in the total"
        />
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
                  <option v-for="t in ACCOUNT_TYPES" :key="t" :value="t">
                    {{ ACCOUNT_TYPE_LABELS[t] }}
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

        <ul v-if="accounts.length" class="cards">
          <li
            v-for="(account, index) in accounts"
            :key="account.id"
            class="card"
            :class="{ 'card-excluded': !account.include_in_total }"
          >
            <div class="card-head">
              <span
                class="dot"
                :style="{
                  background: account.include_in_total
                    ? accountSwatch(index)
                    : 'var(--kapa-neutral-500)',
                }"
              />
              <span class="card-name">{{ account.name }}</span>
              <BaseBadge v-if="!account.include_in_total" variant="excluded">Excluded</BaseBadge>
              <span v-else class="currency-pill">{{ account.currency }}</span>
            </div>

            <div class="card-balance">
              <span class="native">{{
                formatMoney(account.current_balance_minor, account.currency as Currency)
              }}</span>
              <span v-if="convertedMinor(toConvertible(account)) !== null" class="converted">
                ≈ {{ formatMoney(convertedMinor(toConvertible(account))!, spaceCurrency) }}
              </span>
            </div>

            <div class="progress-track">
              <span
                v-if="shareOfTotal(account) !== null"
                class="progress-fill"
                :style="{
                  width: `${(shareOfTotal(account) ?? 0) * 100}%`,
                  background: accountSwatch(index),
                }"
              />
            </div>

            <span class="card-caption">
              <template v-if="!account.include_in_total">excluded from the projection</template>
              <template v-else-if="shareOfTotal(account) !== null">
                {{ Math.round((shareOfTotal(account) ?? 0) * 100) }}% of total
              </template>
              <template v-else>rate unavailable</template>
            </span>

            <div class="card-actions">
              <BaseButton variant="ghost" @click="startEdit(account.id)">Edit</BaseButton>
              <BaseButton variant="ghost" @click="onArchive(account.id)">Archive</BaseButton>
            </div>
          </li>
        </ul>
      </template>
    </div>

    <aside class="page-side">
      <ReconcilePanel :accounts="accounts" @saved="refresh" />
      <FxSnapshotPanel
        :space-currency="spaceCurrency"
        :currencies="foreignCurrencies"
        :rate-for="rateForCurrency"
        :loading="fxLoading"
        @refresh="refreshRates"
      />
    </aside>
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

.page-side {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
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

.cards {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--kapa-space-3);
}

@media (max-width: 760px) {
  .cards {
    grid-template-columns: 1fr;
    gap: var(--kapa-space-2);
  }
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
  padding: var(--kapa-space-4);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
}

.card-excluded {
  /* Dimmed, not the only signal — the badge, empty progress track, and
     caption below all carry the "excluded" meaning independent of colour. */
  opacity: 0.7;
}

.card-head {
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 999px;
  flex-shrink: 0;
}

.card-name {
  font-weight: 600;
  color: var(--kapa-ink);
  flex: 1;
  min-width: 0;
}

.currency-pill {
  font-size: var(--kapa-text-caption-size);
  font-weight: 600;
  color: var(--kapa-ink-muted);
  background: var(--kapa-neutral-200);
  padding: 0 var(--kapa-space-2);
  border-radius: 999px;
}

.card-balance {
  display: flex;
  align-items: baseline;
  gap: var(--kapa-space-2);
  flex-wrap: wrap;
}

.native {
  font-family: var(--font-heading);
  font-size: var(--kapa-text-title-size);
  color: var(--kapa-ink);
}

.converted {
  font-size: var(--kapa-text-caption-size);
  font-weight: 400;
  color: var(--kapa-ink-muted);
}

.progress-track {
  height: 8px;
  border-radius: 999px;
  overflow: hidden;
  background: var(--kapa-neutral-300);
}

.progress-fill {
  display: block;
  height: 100%;
}

.card-caption {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.card-actions {
  display: flex;
  gap: var(--kapa-space-1);
  justify-content: flex-end;
}
</style>
