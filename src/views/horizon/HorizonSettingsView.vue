<script setup lang="ts">
import { computed } from 'vue';
import CapAssumptionNote from '@/components/horizon/CapAssumptionNote.vue';
import EventOrderEditor from '@/components/horizon/EventOrderEditor.vue';
import HolidayEditor from '@/components/horizon/HolidayEditor.vue';
import WorkCalendarEditor from '@/components/horizon/WorkCalendarEditor.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useHorizonSettings } from '@/composables/useHorizonSettings';
import { useSettingsConsequences } from '@/composables/useSettingsConsequences';
import type { EventOrder, SpendMode } from '@roman-mik/kapa-core/horizon/queries';
import type { Currency } from '@roman-mik/kapa-core/pocket';

const {
  settings,
  workingWeekdays,
  holidays,
  capMinor,
  loading,
  error,
  saveEventOrder,
  saveSpendMode,
  saveWorkCalendar,
  addHolidayForSpace,
  removeHoliday,
} = useHorizonSettings();

const {
  loading: consequencesLoading,
  eventOrderSentence,
  spendModeSentence,
  refresh: refreshConsequences,
} = useSettingsConsequences();

async function onSaveEventOrder(order: EventOrder): Promise<void> {
  await saveEventOrder(order);
  await refreshConsequences();
}

async function onSaveSpendMode(mode: SpendMode): Promise<void> {
  await saveSpendMode(mode);
  await refreshConsequences();
}

const spendMode = computed(() => settings.value?.spend_mode ?? 'cap');
const DEFAULT_EVENT_ORDER: EventOrder = 'income,oneOffIn,obligation,plannedSpend,oneOffOut';
const eventOrder = computed<EventOrder>(
  () => (settings.value?.event_order as EventOrder) ?? DEFAULT_EVENT_ORDER
);
const reportingCurrency = computed<Currency>(
  () => (settings.value?.reporting_currency ?? 'RSD') as Currency
);
</script>

<template>
  <main class="page page--wide">
    <h1>Settings</h1>

    <template v-if="loading && !settings">
      <SkeletonBlock height="120px" radius="md" />
      <SkeletonBlock height="120px" radius="md" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else-if="settings">
      <section class="section">
        <BaseCard class="settings-card">
          <h2>Same-day event order</h2>
          <EventOrderEditor :model-value="eventOrder" @update:model-value="onSaveEventOrder" />
          <SkeletonBlock v-if="consequencesLoading" height="20px" radius="sm" class="consequence" />
          <p v-else-if="eventOrderSentence" class="consequence">{{ eventOrderSentence }}</p>
        </BaseCard>
      </section>

      <section class="section">
        <BaseCard class="settings-card">
          <h2>Forward spend mode</h2>
          <p class="hint">
            Cap mode projects that you stick to your Pocket budget; run-rate mode projects from your
            recent actual spending. Use whichever answers "how much will I have?"
          </p>
          <div class="segmented" role="radiogroup" aria-label="Forward spend mode">
            <button
              type="button"
              role="radio"
              :aria-checked="spendMode === 'cap'"
              :class="{ active: spendMode === 'cap' }"
              @click="onSaveSpendMode('cap')"
            >
              Cap
            </button>
            <button
              type="button"
              role="radio"
              :aria-checked="spendMode === 'runRate'"
              :class="{ active: spendMode === 'runRate' }"
              @click="onSaveSpendMode('runRate')"
            >
              Run rate
            </button>
          </div>
          <CapAssumptionNote
            v-if="spendMode === 'cap'"
            :cap-minor="capMinor"
            :currency="reportingCurrency"
          />
          <SkeletonBlock v-if="consequencesLoading" height="20px" radius="sm" class="consequence" />
          <p v-else-if="spendModeSentence" class="consequence">{{ spendModeSentence }}</p>
        </BaseCard>
      </section>

      <section class="section">
        <BaseCard class="settings-card">
          <h2>Work calendar</h2>
          <WorkCalendarEditor
            :model-value="workingWeekdays"
            @update:model-value="saveWorkCalendar"
          />
        </BaseCard>
      </section>

      <section class="section">
        <BaseCard class="settings-card">
          <h2>Holidays</h2>
          <HolidayEditor :holidays="holidays" :add="addHolidayForSpace" :remove="removeHoliday" />
        </BaseCard>
      </section>
    </template>

    <EmptyState v-else title="No space selected" message="Pick a space to configure Horizon." />
  </main>
</template>

<style scoped>
.error {
  color: var(--kapa-negative);
  margin: 0;
}

.section {
  margin-bottom: var(--kapa-space-5);
}

.settings-card h2 {
  margin-bottom: var(--kapa-space-3);
}

.hint {
  margin: 0 0 var(--kapa-space-3);
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.consequence {
  margin: var(--kapa-space-3) 0 0;
  color: var(--kapa-ink-muted);
  font-size: var(--kapa-text-caption-size);
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
  overflow: hidden;
  margin-bottom: var(--kapa-space-4);
}

.segmented button {
  padding: var(--kapa-space-2) var(--kapa-space-4);
  border: none;
  background: var(--kapa-surface);
  color: var(--kapa-ink-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.segmented button.active {
  background: var(--kapa-accent-100);
  color: var(--kapa-accent-700);
}
</style>
