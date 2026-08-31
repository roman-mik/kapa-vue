<script setup lang="ts">
import type { Holiday } from '@roman-mik/kapa-core/horizon/queries';
import { zonedDateKey } from '@roman-mik/kapa-core/pocket';
import { ref } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import { categoryNameSchema, expenseDateSchema, firstIssueMessage } from '@/lib/validation';
import { formatFullDate } from '@/lib/date';
import { useSpaceStore } from '@/stores/space';

const props = defineProps<{
  holidays: Holiday[];
  add: (date: string, name: string) => Promise<{ ok: true } | { ok: false; reason: 'duplicate' }>;
  remove: (holidayId: string) => Promise<void>;
}>();

const space = useSpaceStore();

function todayKey(): string {
  return space.currentSpace ? zonedDateKey(new Date(), space.currentSpace.timezone) : '';
}

const date = ref(todayKey());
const name = ref('');
const saving = ref(false);
const error = ref<string | null>(null);

async function onSubmit(): Promise<void> {
  error.value = null;
  const parsedDate = expenseDateSchema.safeParse(date.value);
  if (!parsedDate.success) {
    error.value = firstIssueMessage(parsedDate) ?? 'Pick a valid date.';
    return;
  }
  const parsedName = categoryNameSchema.safeParse(name.value);
  if (!parsedName.success) {
    error.value = firstIssueMessage(parsedName) ?? 'Enter a name.';
    return;
  }
  saving.value = true;
  try {
    const outcome = await props.add(parsedDate.data, parsedName.data);
    if (!outcome.ok) {
      error.value = 'That date already has a holiday.';
      return;
    }
    name.value = '';
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Couldn't add the holiday.";
  } finally {
    saving.value = false;
  }
}

async function onRemove(id: string): Promise<void> {
  error.value = null;
  saving.value = true;
  try {
    await props.remove(id);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Couldn't remove the holiday.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="holidays">
    <ul v-if="holidays.length" class="list">
      <li v-for="holiday in holidays" :key="holiday.id" class="row">
        <div class="info">
          <span class="name">{{ holiday.name }}</span>
          <span class="date">{{ formatFullDate(holiday.date) }}</span>
        </div>
        <BaseButton
          variant="ghost"
          :disabled="saving"
          aria-label="Remove holiday"
          @click="onRemove(holiday.id)"
        >
          Remove
        </BaseButton>
      </li>
    </ul>
    <p v-else class="empty">No holidays yet.</p>

    <form class="add" @submit.prevent="onSubmit">
      <BaseField label="Date" v-slot="{ id }">
        <BaseInput :id="id" v-model="date" type="date" required />
      </BaseField>
      <BaseField label="Name" v-slot="{ id }">
        <BaseInput :id="id" v-model="name" placeholder="e.g. New Year's Day" required />
      </BaseField>
      <BaseButton type="submit" :disabled="saving">
        {{ saving ? 'Adding…' : 'Add holiday' }}
      </BaseButton>
    </form>

    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </div>
</template>

<style scoped>
.holidays {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
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
  padding: var(--kapa-space-2) var(--kapa-space-3);
  background: var(--kapa-surface);
  border: 1px solid var(--kapa-neutral-400);
  border-radius: var(--kapa-radius-md);
}

.info {
  display: flex;
  flex-direction: column;
}

.name {
  font-weight: 600;
  color: var(--kapa-ink);
}

.date {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.empty {
  margin: 0;
  color: var(--kapa-ink-muted);
}

.add {
  display: flex;
  align-items: flex-end;
  gap: var(--kapa-space-3);
  flex-wrap: wrap;
}

.error {
  margin: 0;
  color: var(--kapa-negative);
}
</style>
