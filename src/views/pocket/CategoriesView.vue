<script setup lang="ts">
import { ref } from 'vue';
import { SWATCH_SLOTS, type SwatchSlot } from '@roman-mik/kapa-core/theme';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import ConfirmButton from '@/components/ui/ConfirmButton.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import { useCategories } from '@/composables/useCategories';
import { useToast } from '@/composables/useToast';
import { categoryNameSchema, firstIssueMessage } from '@/lib/validation';
import { swatchCssVar } from '@/lib/swatch';

const { categories, loading, error, add, rename, archive, restore, setColor } = useCategories({
  includeArchived: true,
});
const toast = useToast();

const newName = ref('');
const adding = ref(false);
const addError = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const renameError = ref<string | null>(null);
const pickingColorId = ref<string | null>(null);
const busyId = ref<string | null>(null);

async function onAdd(): Promise<void> {
  addError.value = null;
  const parsed = categoryNameSchema.safeParse(newName.value);
  if (!parsed.success) {
    addError.value = firstIssueMessage(parsed) ?? 'Enter a name.';
    return;
  }
  adding.value = true;
  try {
    await add(parsed.data);
    newName.value = '';
    toast.success('Category added');
  } catch (err) {
    addError.value = err instanceof Error ? err.message : "Couldn't add that category.";
    toast.error(addError.value);
  } finally {
    adding.value = false;
  }
}

function startRename(id: string, currentName: string): void {
  renamingId.value = id;
  renameValue.value = currentName;
  renameError.value = null;
}

async function confirmRename(id: string): Promise<void> {
  renameError.value = null;
  const parsed = categoryNameSchema.safeParse(renameValue.value);
  if (!parsed.success) {
    renameError.value = firstIssueMessage(parsed) ?? 'Enter a name.';
    return;
  }
  renamingId.value = null;
  busyId.value = id;
  try {
    await rename(id, parsed.data);
    toast.success('Category renamed');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't rename that category.");
  } finally {
    busyId.value = null;
  }
}

async function onArchive(id: string): Promise<void> {
  busyId.value = id;
  try {
    await archive(id);
    toast.success('Category archived');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't archive that category.");
  } finally {
    busyId.value = null;
  }
}

function toggleColorPicker(id: string): void {
  pickingColorId.value = pickingColorId.value === id ? null : id;
}

async function onPickColor(id: string, slot: SwatchSlot | null): Promise<void> {
  pickingColorId.value = null;
  busyId.value = id;
  try {
    await setColor(id, slot);
    toast.success(slot ? 'Colour updated' : 'Colour cleared');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't update that colour.");
  } finally {
    busyId.value = null;
  }
}

async function onRestore(id: string): Promise<void> {
  busyId.value = id;
  try {
    await restore(id);
    toast.success('Category restored');
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't restore that category.");
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <main class="page">
    <h1>Categories</h1>

    <template v-if="loading && !categories.length">
      <SkeletonBlock height="48px" />
      <SkeletonBlock height="48px" />
      <SkeletonBlock height="48px" />
    </template>

    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <ul class="list">
        <li
          v-for="category in categories"
          :key="category.id"
          :class="{ archived: category.archived }"
        >
          <BaseCard padding="sm">
            <div class="row-content">
              <template v-if="renamingId === category.id">
                <div class="rename">
                  <BaseInput
                    v-model="renameValue"
                    type="text"
                    maxlength="60"
                    @keyup.enter="confirmRename(category.id)"
                  />
                  <p v-if="renameError" role="alert" class="error">{{ renameError }}</p>
                </div>
                <BaseButton variant="secondary" @click="confirmRename(category.id)"
                  >Save</BaseButton
                >
                <BaseButton variant="ghost" @click="renamingId = null">Cancel</BaseButton>
              </template>
              <template v-else>
                <button
                  type="button"
                  class="swatch-dot"
                  :class="{ 'swatch-dot--empty': !category.color }"
                  :style="
                    category.color
                      ? { background: swatchCssVar(category.color as SwatchSlot) }
                      : undefined
                  "
                  :aria-label="
                    category.color
                      ? `Change colour (current: ${category.color})`
                      : 'Choose a colour'
                  "
                  :disabled="busyId === category.id"
                  @click="toggleColorPicker(category.id)"
                />
                <span class="name">{{ category.name }}</span>
                <span v-if="category.archived" class="badge">Archived</span>
                <template v-if="!category.archived">
                  <BaseButton
                    variant="ghost"
                    :disabled="busyId === category.id"
                    @click="startRename(category.id, category.name)"
                  >
                    Rename
                  </BaseButton>
                  <ConfirmButton
                    label="Archive"
                    confirm-label="Really archive?"
                    :disabled="busyId === category.id"
                    @confirm="onArchive(category.id)"
                  />
                </template>
                <BaseButton
                  v-else
                  variant="ghost"
                  :disabled="busyId === category.id"
                  @click="onRestore(category.id)"
                >
                  Restore
                </BaseButton>
              </template>
              <div
                v-if="pickingColorId === category.id"
                class="swatch-row"
                role="radiogroup"
                :aria-label="`Colour for ${category.name}`"
              >
                <button
                  v-for="slot in SWATCH_SLOTS"
                  :key="slot"
                  type="button"
                  class="swatch-dot swatch-choice"
                  :style="{ background: swatchCssVar(slot) }"
                  :aria-pressed="category.color === slot"
                  :aria-label="slot"
                  @click="onPickColor(category.id, slot)"
                />
                <BaseButton variant="ghost" @click="onPickColor(category.id, null)"
                  >None</BaseButton
                >
              </div>
            </div>
          </BaseCard>
        </li>
      </ul>

      <form class="add" @submit.prevent="onAdd">
        <BaseField label="New category" v-slot="{ id }">
          <BaseInput :id="id" v-model="newName" type="text" maxlength="60" required />
        </BaseField>
        <p v-if="addError" role="alert" class="error">{{ addError }}</p>
        <BaseButton type="submit" block :disabled="adding || !newName.trim()">
          {{ adding ? 'Adding…' : 'Add category' }}
        </BaseButton>
      </form>
    </template>
  </main>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0 0 var(--kapa-space-5);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.row-content {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--kapa-space-2);
}

.swatch-dot {
  width: 16px;
  height: 16px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid var(--kapa-neutral-400);
  cursor: pointer;
  flex-shrink: 0;
}

.swatch-dot--empty {
  background: transparent;
  border-style: dashed;
}

.swatch-row {
  flex-basis: 100%;
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
}

.swatch-choice[aria-pressed='true'] {
  outline: 2px solid var(--kapa-accent-600);
  outline-offset: 1px;
}

.list li.archived {
  opacity: 0.6;
}

.name {
  flex: 1;
}

.rename {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-1);
}

.rename .error {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
}

.badge {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.add {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
