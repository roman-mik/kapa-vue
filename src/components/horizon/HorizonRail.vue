<script setup lang="ts">
import type { Currency } from '@roman-mik/kapa-core/pocket';
import { computed } from 'vue';
import { useAccounts } from '@/composables/useAccounts';
import { useConvertedAmount, type Convertible } from '@/composables/useConvertedAmount';
import { useIncomeStreams } from '@/composables/useIncomeStreams';
import { useObligations } from '@/composables/useObligations';
import { formatMoney } from '@/lib/money';
import { formatFullDate } from '@/lib/date';
import { useSpaceStore } from '@/stores/space';

// Six desktop routes per HorizonRail.dc.html. Note: the rail carries Money in
// and Money out separately (it has room for both), unlike the phone bar's
// single Money tab.
const links = [
  { name: 'horizon-today', label: 'Today', icon: 'today' },
  { name: 'horizon-accounts', label: 'Accounts', icon: 'accounts' },
  { name: 'horizon-timeline', label: 'Timeline', icon: 'timeline' },
  { name: 'horizon-money-in', label: 'Money in', icon: 'in' },
  { name: 'horizon-money-out', label: 'Money out', icon: 'out' },
  { name: 'horizon-settings', label: 'Settings', icon: 'settings' },
] as const;

const space = useSpaceStore();
const spaceCurrency = computed<Currency>(() => (space.currentSpace?.currency ?? 'RSD') as Currency);
const spaceName = computed(() => space.currentSpace?.name ?? '');

// Accounts summary block: per-account converted rows + a bold total, matching
// the AccountsView total (conversion-aware, include_in_total only).
const { accounts } = useAccounts();
const convertibles = computed<Convertible[]>(() => accounts.value.map(toConvertible));
const { spaceCurrencyAmount, fxAsOf } = useConvertedAmount(convertibles);
const includedAccounts = computed(() => accounts.value.filter((a) => a.include_in_total));
const totalMinor = computed(() =>
  includedAccounts.value.reduce((sum, a) => sum + (spaceCurrencyAmount(toConvertible(a)) ?? 0), 0)
);

function toConvertible(a: {
  id: string;
  currency: string;
  current_balance_minor: number;
}): Convertible {
  return { id: a.id, currency: a.currency as Currency, amountMinor: a.current_balance_minor };
}

// The space-currency figure for an account row, or '—' when foreign and
// un-ratable (a zero would silently understate it, same wording as the
// AccountsView unconverted note).
function accountAmount(a: { id: string; currency: string; current_balance_minor: number }): string {
  const converted = spaceCurrencyAmount(toConvertible(a));
  return converted !== null ? formatMoney(converted, spaceCurrency.value) : '—';
}

// Footer: FX honesty + confidence split. The FX snapshot names the newest
// rate date and its age; the estimates count sums income + obligation rows
// the projection treats as non-confirmed.
const { nonConfirmedCount: incomeEstimates } = useIncomeStreams();
const { nonConfirmedCount: obligationEstimates } = useObligations();
const estimates = computed(() => incomeEstimates.value + obligationEstimates.value);

const fx = computed(() => {
  const asOf = fxAsOf();
  if (!asOf) return null;
  const days = asOf.ageDays === 1 ? '1 day old' : `${asOf.ageDays} days old`;
  return `${formatFullDate(asOf.date)} · ${days}`;
});
</script>

<template>
  <nav class="rail" aria-label="Horizon">
    <div class="brand">
      <span class="title">Horizon</span>
      <span class="subtitle"> {{ spaceName }} · {{ spaceCurrency }} household </span>
    </div>

    <div class="links">
      <router-link
        v-for="link in links"
        :key="link.name"
        :to="{ name: link.name }"
        class="link"
        active-class="active"
        exact-active-class="active"
      >
        <span class="link-icon">
          <svg
            v-if="link.icon === 'today'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 11l8-7 8 7" />
            <path d="M5 10v8h12v-8" />
          </svg>
          <svg
            v-else-if="link.icon === 'accounts'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 6h16v11H3z" />
            <path d="M3 10h16" />
          </svg>
          <svg
            v-else-if="link.icon === 'timeline'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 15l5-6 4 3 6-8" />
          </svg>
          <svg
            v-else-if="link.icon === 'in'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 18V4" />
            <path d="M5 10l6-6 6 6" />
          </svg>
          <svg
            v-else-if="link.icon === 'out'"
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11 4v14" />
            <path d="M5 12l6 6 6-6" />
          </svg>
          <svg
            v-else
            viewBox="0 0 22 22"
            fill="none"
            stroke="currentColor"
            stroke-width="2.75"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="3" />
            <path d="M11 2v3" />
            <path d="M11 17v3" />
            <path d="M2 11h3" />
            <path d="M17 11h3" />
          </svg>
        </span>
        <span>{{ link.label }}</span>
      </router-link>
    </div>

    <div v-if="accounts.length" class="accounts">
      <span class="accounts-heading">Accounts</span>
      <div class="accounts-rows">
        <span
          v-for="account in accounts"
          :key="account.id"
          class="account-row"
          :class="{ excluded: !account.include_in_total }"
        >
          <span class="account-name">{{ account.name }}</span>
          <strong>{{ accountAmount(account) }}</strong>
        </span>
        <span class="account-row total">
          <span class="account-name">Total</span>
          <strong>{{ formatMoney(totalMinor, spaceCurrency) }}</strong>
        </span>
      </div>
    </div>

    <div class="footer">
      <span v-if="fx" class="fx">{{ fx }}</span>
      <span class="estimates">{{ estimates }} estimates in this projection</span>
    </div>
  </nav>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
  width: 224px;
  flex: none;
  box-sizing: border-box;
  border-right: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  padding: var(--kapa-space-5) var(--kapa-space-4) var(--kapa-space-4);
}

.brand {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 var(--kapa-space-2);
}

.title {
  font-family: var(--font-heading);
  font-size: 23px;
  line-height: 1.1;
  color: var(--kapa-ink);
}

.subtitle {
  font-size: 11.5px;
  color: var(--kapa-ink-muted);
}

.links {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--kapa-ink-muted);
  text-decoration: none;
  transition:
    background-color var(--kapa-motion-fast) var(--kapa-motion-ease),
    color var(--kapa-motion-fast) var(--kapa-motion-ease);
}

.link-icon {
  width: 18px;
  height: 18px;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.link svg {
  width: 18px;
  height: 18px;
}

.link.active {
  background: var(--kapa-accent);
  color: var(--kapa-white);
  font-weight: 700;
}

.accounts {
  padding: var(--kapa-space-3);
  background: var(--kapa-neutral-100);
  border-radius: 18px;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.accounts-heading {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--kapa-ink-muted);
}

.accounts-rows {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.account-row {
  display: flex;
  justify-content: space-between;
  gap: var(--kapa-space-2);
  font-size: 13px;
  color: var(--kapa-ink);
}

.account-row .account-name {
  color: var(--kapa-ink-muted);
}

.account-row.excluded .account-name {
  color: var(--kapa-ink-subtle);
  text-decoration: line-through;
}

.account-row.total {
  border-top: 1px solid var(--kapa-neutral-300);
  padding-top: var(--kapa-space-1);
}

.footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
  padding: 0 var(--kapa-space-2);
}

.fx {
  font-size: 11.5px;
  color: var(--kapa-ink-muted);
  line-height: 1.5;
}

.estimates {
  font-size: 11.5px;
  font-weight: 700;
  color: var(--kapa-accent-700);
}
</style>
