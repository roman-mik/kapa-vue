<script setup lang="ts">
// A dark instrument panel showing one month of the Horizon fixture's events
// (src/lib/landing/horizonDemo.ts) — native amount, the period a payment
// actually covers (D4), and the running balance after it. Horizon's real
// projection engine isn't built yet (kapa-core only has `listAccounts`), so
// this carries an honest "in design" marker rather than implying it ships.
import { computed } from 'vue';
import { formatMoney } from '@/lib/money';
import type { HorizonProjection } from '@/lib/landing/horizonDemo';

const props = defineProps<{ projection: HorizonProjection; month: string }>();

const rows = computed(() => props.projection.events.filter((e) => e.date.startsWith(props.month)));

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
</script>

<template>
  <div class="ledger">
    <div class="ledger-head">
      <span class="eyebrow l-mono">Horizon · one month</span>
      <span class="badge l-mono">In design</span>
    </div>
    <p class="note">
      The projection engine below is specified, not built — see
      <code class="l-mono">tracker/docs/horizon-user-stories.md</code>. These rows are a
      deterministic fixture, not live data.
    </p>

    <ul class="rows">
      <li v-for="(event, i) in rows" :key="`${event.date}-${event.label}-${i}`" class="row">
        <span class="date l-mono">{{ formatDate(event.date) }}</span>
        <span class="label">
          {{ event.label }}
          <span v-if="event.coversPeriod" class="covers">covers {{ event.coversPeriod }}</span>
        </span>
        <span class="amount l-mono" :class="{ negative: event.amountMinor < 0 }">
          {{ event.amountMinor < 0 ? '−' : '+'
          }}{{ formatMoney(Math.abs(event.amountMinor), event.currency) }}
        </span>
        <span class="balance l-mono" :class="{ negative: event.balanceAfter < 0 }">
          <span v-if="event.balanceAfter < 0" class="marker" aria-hidden="true">▼</span>
          {{ formatMoney(event.balanceAfter, projection.currency) }}
          <span v-if="event.balanceAfter < 0" class="sr-only"> — balance goes negative</span>
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.ledger {
  background: var(--l-horizon-panel);
  border: 1px solid var(--l-line);
  border-radius: 20px;
  padding: 20px;
  box-shadow: 0 16px 32px -18px rgb(76 96 62 / 0.2);
}

.ledger-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.eyebrow {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--l-signal);
}

.badge {
  font-size: 11px;
  letter-spacing: 0.04em;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--l-line);
  color: var(--l-haze);
}

.note {
  font-size: 12px;
  margin: 0 0 14px;
  color: var(--l-haze);
}

.note code {
  font-size: 11px;
  color: var(--l-haze);
}

.rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.row {
  display: grid;
  grid-template-columns: 52px 1fr auto auto;
  gap: 10px;
  align-items: baseline;
  padding: 8px 0;
  border-top: 1px solid var(--l-line);
  font-size: 13px;
}

.row:first-child {
  border-top: none;
}

.date {
  color: var(--l-haze);
  font-size: 12px;
}

.label {
  display: flex;
  flex-direction: column;
  color: var(--l-ink);
}

.covers {
  font-size: 11px;
  color: var(--l-haze);
}

.amount {
  color: var(--l-ink);
  white-space: nowrap;
}

.amount.negative {
  color: var(--l-haze);
}

.balance {
  white-space: nowrap;
  color: var(--l-signal);
}

.balance.negative {
  color: var(--l-alarm);
  font-weight: 500;
}

.marker {
  margin-right: 2px;
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

@media (max-width: 520px) {
  .row {
    grid-template-columns: 44px 1fr;
    grid-template-areas: 'date label' 'amount balance';
    row-gap: 2px;
  }

  .date {
    grid-area: date;
  }

  .label {
    grid-area: label;
  }

  .amount {
    grid-area: amount;
  }

  .balance {
    grid-area: balance;
    justify-self: end;
  }
}
</style>
