<script setup lang="ts">
import { ref, watch } from 'vue';
import { useHistoryCoverage } from '@/composables/useHistoryCoverage';
import { useSpaceStore } from '@/stores/space';
import BaseButton from '@/components/ui/BaseButton.vue';
const history = useHistoryCoverage();
const space = useSpaceStore();
const from = ref('');
const through = ref('');
const confirmed = ref(false);
const dirty = ref(false);
watch(
  () => space.currentSpaceId,
  () => {
    from.value = '';
    through.value = '';
    confirmed.value = false;
    dirty.value = false;
  }
);
watch(
  [history.review, history.window],
  () => {
    if (dirty.value) return;
    from.value = history.review.value?.recorded_from ?? history.window.value.windowStart;
    through.value = history.review.value?.recorded_through ?? history.window.value.windowEnd;
  },
  { immediate: true }
);
async function save() {
  if (!confirmed.value) return;
  const saved = await history.save(from.value, through.value);
  if (saved) {
    dirty.value = false;
    confirmed.value = false;
  }
}
</script>
<template>
  <section id="history-coverage" aria-labelledby="history-title">
    <h2 id="history-title">Recorded spending history</h2>
    <p>
      Run-rate forecasts need every everyday expense recorded from
      {{ history.window.value.windowStart }} through {{ history.window.value.windowEnd }}. Empty
      history is not confirmed zero spending.
    </p>
    <p v-if="history.review.value">
      Confirmed {{ history.review.value.recorded_from }} through
      {{ history.review.value.recorded_through }} on
      {{ history.review.value.confirmed_at.slice(0, 10) }} ({{ history.review.value.time_zone }}).
      New days are not confirmed automatically.
    </p>
    <p
      v-if="history.review.value && history.review.value.time_zone !== space.currentSpace?.timezone"
      role="status"
    >
      The space timezone changed. Confirm this date range again.
    </p>
    <form @submit.prevent="save">
      <label
        >Recorded from <input v-model="from" type="date" required @input="dirty = true"
      /></label>
      <label
        >Recorded through
        <input
          v-model="through"
          type="date"
          required
          :min="from"
          :max="history.today.value"
          @input="dirty = true"
      /></label>
      <label
        ><input v-model="confirmed" type="checkbox" /> I have recorded all everyday spending in this
        period, including days with no spending.</label
      >
      <p v-if="history.saveError.value || history.error.value" role="alert">
        {{ history.saveError.value || history.error.value }}
      </p>
      <BaseButton
        type="submit"
        :disabled="
          !confirmed || history.saving.value || history.loading.value || !!history.error.value
        "
        >{{ history.saving.value ? 'Saving…' : 'Confirm recorded history' }}</BaseButton
      >
      <BaseButton
        type="button"
        variant="secondary"
        :disabled="history.loading.value"
        @click="history.refresh()"
        >Reload review</BaseButton
      >
    </form>
  </section>
</template>
<style scoped>
section {
  overflow-wrap: anywhere;
}
label {
  display: block;
  margin: var(--kapa-space-3) 0;
}
input[type='date'] {
  display: block;
  max-width: 100%;
  min-height: 44px;
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  border: 1px solid var(--kapa-neutral-400);
  padding: var(--kapa-space-2);
}
input:focus-visible {
  outline: 2px solid var(--kapa-ink);
  outline-offset: 2px;
}
</style>
