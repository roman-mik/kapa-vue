<script setup lang="ts">
import type { ForecastAssessment } from '@roman-mik/kapa-core/horizon';
import { usePaymentLinkSheet } from '@/composables/usePaymentLinkSheet';
import BaseButton from '@/components/ui/BaseButton.vue';
withDefaults(
  defineProps<{ assessment?: ForecastAssessment; loading?: boolean; error?: string | null }>(),
  { loading: false, error: null }
);
const sheet = usePaymentLinkSheet();
const emit = defineEmits<{ inspect: [] }>();
function cash() {
  emit('inspect');
  sheet.open();
}
</script>
<template>
  <section v-if="assessment" class="forecast-status" aria-label="Forecast assumptions">
    <p role="status">
      {{
        loading
          ? 'Updating forecast; displayed amounts are from the previous load.'
          : error
            ? 'Forecast unavailable; displayed amounts may be out of date.'
            : assessment.complete
              ? 'Forecast covers the listed accounts and spending assumptions.'
              : 'Forecast incomplete; projected amounts are partial.'
      }}
    </p>
    <ul v-if="!loading && !error">
      <li v-for="issue in assessment.issues" :key="issue.code + issue.message">
        {{ issue.message }}
        <router-link
          v-if="issue.repair === 'history'"
          :to="{ name: 'horizon-settings', hash: '#history-coverage' }"
          @click="emit('inspect')"
          >Review recorded history</router-link
        >
        <router-link
          v-else-if="issue.repair === 'cap'"
          :to="{ name: 'pocket-cap' }"
          @click="emit('inspect')"
          >Set spending cap</router-link
        >
        <router-link
          v-else-if="issue.repair === 'fx'"
          :to="{ name: 'horizon-accounts' }"
          @click="emit('inspect')"
          >Review exchange rates</router-link
        >
        <BaseButton v-else variant="secondary" @click="cash"
          >Review payments and balances</BaseButton
        >
      </li>
    </ul>
    <details>
      <summary>Accounts and assumptions</summary>
      <p>
        {{ assessment.provenance.range.from }} through {{ assessment.provenance.range.to }} ({{
          assessment.provenance.timeZone
        }}). Spending mode: {{ assessment.provenance.spendMode }}. Everyday allowance is shared
        across included accounts; it does not prove an individual account can pay a bill.
      </p>
      <p>
        {{ assessment.provenance.includedAccountIds.length }} included accounts;
        {{ assessment.provenance.excludedAccountIds.length }} excluded.
        <router-link :to="{ name: 'horizon-accounts' }" @click="emit('inspect')"
          >View account scope</router-link
        >
      </p>
      <p v-for="observation in assessment.provenance.observationDates" :key="observation.accountId">
        Account {{ observation.accountId }} checked {{ observation.checkedAt }}; subsequent cash is
        estimated.
      </p>
      <p>
        Inputs loaded {{ assessment.provenance.fetchedAt }}. FX dates:
        {{ assessment.provenance.fxDates.join(', ') || 'No conversions required' }}.
      </p>
    </details>
  </section>
</template>
<style scoped>
.forecast-status {
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  padding: var(--kapa-space-3);
  margin-bottom: var(--kapa-space-3);
  overflow-wrap: anywhere;
}
a,
summary {
  display: inline-block;
  min-height: 44px;
  padding: var(--kapa-space-2);
}
</style>
