<script setup lang="ts">
import type { Category } from '@roman-mik/kapa-core/core';
import { SWATCH_SLOTS, type SwatchSlot } from '@roman-mik/kapa-core/theme';
import { computed, ref, watch } from 'vue';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseCard from '@/components/ui/BaseCard.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue';
import CategoryShareBar from '@/components/pocket/CategoryShareBar.vue';
import ExpenseRowMenu from '@/components/pocket/ExpenseRowMenu.vue';
import type { RowMenuAction } from '@/components/pocket/expenseRowMenu';
import { useCategories } from '@/composables/useCategories';
import { useExpenses } from '@/composables/useExpenses';
import { usePocketHome } from '@/composables/usePocketHome';
import { useToast } from '@/composables/useToast';
import { useViewport } from '@/composables/useViewport';
import { categorySharePct } from '@/lib/categoryShare';
import { formatMoney } from '@/lib/money';
import { swatchCssVar } from '@/lib/swatch';
import { categoryNameSchema, firstIssueMessage } from '@/lib/validation';

const { categories, loading, error, add, rename, archive, restore, setColor } = useCategories({
  includeArchived: true,
});
const { summary } = usePocketHome();
const { expenses } = useExpenses();
const { isDesktop } = useViewport();
const toast = useToast();

const newName = ref('');
const adding = ref(false);
const addError = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const renameError = ref<string | null>(null);
const pickingColorId = ref<string | null>(null);
const busyId = ref<string | null>(null);
const selectedCategoryId = ref<string | null>(null);

const currency = computed(() => summary.value?.currency ?? 'RSD');

// Cap total isn't a dedicated PocketSummary field — recovered the same way
// PocketHomeView's by-category widget does, only needed here for each row's
// proportional-share-of-cap bar.
const capMinor = computed(() =>
  summary.value ? summary.value.spent + summary.value.remaining : 0
);

function categorySpent(categoryId: string): number {
  return summary.value?.categoryBreakdown.find((b) => b.categoryId === categoryId)?.spent ?? 0;
}

function categoryCount(categoryId: string): number {
  return expenses.value.filter((e) => e.category_id === categoryId).length;
}

const selectedCategory = computed<Category | null>(
  () => categories.value.find((c) => c.id === selectedCategoryId.value) ?? null
);

// Keeps a category selected in the desktop detail panel across
// add/archive/restore refreshes — falls back to the first active category
// once the previous selection is gone (e.g. after archiving it).
watch(
  categories,
  (list) => {
    if (selectedCategoryId.value && list.some((c) => c.id === selectedCategoryId.value)) return;
    selectedCategoryId.value = list.find((c) => !c.archived)?.id ?? null;
  },
  { immediate: true }
);

watch(selectedCategory, (category) => {
  if (category) renameValue.value = category.name;
});

function rowMenuActions(category: Category): RowMenuAction[] {
  if (category.archived) {
    return [{ id: 'restore', label: 'Restore', kind: 'action' }];
  }
  return [
    { id: 'rename', label: 'Rename', kind: 'action' },
    { id: 'color', label: 'Colour', kind: 'action' },
    { id: 'archive', label: 'Archive', kind: 'confirm', confirmLabel: 'Really archive?' },
  ];
}

function onRowMenuSelect(category: Category, id: string): void {
  if (id === 'restore') {
    void onRestore(category.id);
  } else if (id === 'rename') {
    selectedCategoryId.value = category.id;
    if (!isDesktop.value) startRename(category.id, category.name);
  } else if (id === 'color') {
    selectedCategoryId.value = category.id;
    if (!isDesktop.value) pickingColorId.value = category.id;
  }
}

function onRowMenuConfirm(category: Category, id: string): void {
  if (id === 'archive') void onArchive(category.id);
}

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
  <main class="page page--with-rail">
    <h1 class="full-row">Categories</h1>

    <template v-if="loading && !categories.length">
      <div class="full-row">
        <SkeletonBlock height="48px" />
        <SkeletonBlock height="48px" />
        <SkeletonBlock height="48px" />
      </div>
    </template>

    <p v-else-if="error" role="alert" class="error full-row">{{ error }}</p>

    <template v-else>
      <div class="page-main">
        <div v-if="isDesktop" class="table-head" role="row">
          <span role="columnheader">Category</span>
          <span role="columnheader">This month</span>
          <span role="columnheader">Expenses</span>
          <span role="columnheader">Share</span>
          <span role="columnheader" aria-hidden="true" />
        </div>

        <ul class="list">
          <li
            v-for="category in categories"
            :key="category.id"
            :class="{
              archived: category.archived,
              selected: isDesktop && selectedCategoryId === category.id,
            }"
          >
            <BaseCard
              padding="sm"
              class="row-card"
              :class="{ clickable: isDesktop }"
              @click="isDesktop && (selectedCategoryId = category.id)"
            >
              <div v-if="!isDesktop && renamingId === category.id" class="row-content">
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
              </div>

              <div v-else class="row-content">
                <div class="category-col">
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
                    :disabled="busyId === category.id || isDesktop"
                    @click.stop="!isDesktop && toggleColorPicker(category.id)"
                  />

                  <div class="name-block">
                    <span class="name">{{ category.name }}</span>
                    <span v-if="category.archived" class="badge">Archived</span>
                    <span v-else class="count count--mobile">
                      {{ categoryCount(category.id) }}
                      {{ categoryCount(category.id) === 1 ? 'expense' : 'expenses' }} this month
                    </span>
                  </div>
                </div>

                <span class="amount money-amount">
                  {{ category.archived ? '—' : formatMoney(categorySpent(category.id), currency) }}
                </span>

                <span class="count count--desktop">{{
                  category.archived ? '0' : categoryCount(category.id)
                }}</span>

                <div class="share-col">
                  <template v-if="!category.archived">
                    <CategoryShareBar
                      :percent="categorySharePct(categorySpent(category.id), capMinor)"
                      :color="
                        category.color ? swatchCssVar(category.color as SwatchSlot) : undefined
                      "
                    />
                    <span class="share-pct">
                      {{ Math.round(categorySharePct(categorySpent(category.id), capMinor)) }}%
                    </span>
                  </template>
                </div>

                <ExpenseRowMenu
                  :actions="rowMenuActions(category)"
                  :trigger-label="`Actions for ${category.name}`"
                  @click.stop
                  @select="onRowMenuSelect(category, $event)"
                  @confirm="onRowMenuConfirm(category, $event)"
                />
              </div>

              <div
                v-if="!isDesktop && pickingColorId === category.id"
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
      </div>

      <aside v-if="isDesktop && selectedCategory" class="page-side">
        <BaseCard class="detail-panel">
          <h2>{{ selectedCategory.name }}</h2>
          <BaseField label="Name" v-slot="{ id }">
            <BaseInput
              :id="id"
              v-model="renameValue"
              type="text"
              maxlength="60"
              @keyup.enter="confirmRename(selectedCategory.id)"
            />
          </BaseField>
          <p v-if="renameError" role="alert" class="error">{{ renameError }}</p>

          <div
            class="swatch-row"
            role="radiogroup"
            :aria-label="`Colour for ${selectedCategory.name}`"
          >
            <button
              v-for="slot in SWATCH_SLOTS"
              :key="slot"
              type="button"
              class="swatch-dot swatch-choice swatch-choice--lg"
              :style="{ background: swatchCssVar(slot) }"
              :aria-pressed="selectedCategory.color === slot"
              :aria-label="slot"
              @click="onPickColor(selectedCategory.id, slot)"
            />
            <BaseButton variant="ghost" @click="onPickColor(selectedCategory.id, null)"
              >None</BaseButton
            >
          </div>

          <div class="detail-actions">
            <BaseButton
              variant="secondary"
              :disabled="busyId === selectedCategory.id"
              @click="confirmRename(selectedCategory.id)"
            >
              Save
            </BaseButton>
            <BaseButton
              v-if="!selectedCategory.archived"
              variant="ghost"
              :disabled="busyId === selectedCategory.id"
              @click="onArchive(selectedCategory.id)"
            >
              Archive
            </BaseButton>
            <BaseButton
              v-else
              variant="ghost"
              :disabled="busyId === selectedCategory.id"
              @click="onRestore(selectedCategory.id)"
            >
              Restore
            </BaseButton>
          </div>
        </BaseCard>

        <BaseCard class="archive-note" padding="sm">
          <h3>Archiving never deletes</h3>
          <p>
            Archiving keeps past expenses and their colour; the category just disappears from Add's
            category chips until it's restored.
          </p>
        </BaseCard>
      </aside>
    </template>
  </main>
</template>

<style scoped>
.full-row {
  grid-column: 1 / -1;
}

.page-main {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.page-side {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
}

.table-head {
  display: none;
}

@media (min-width: 760px) {
  .table-head {
    display: grid;
    grid-template-columns: 1fr 150px 130px 140px 52px;
    gap: var(--kapa-space-2);
    padding: 0 var(--kapa-space-4);
    font-size: var(--kapa-text-caption-size);
    font-weight: 600;
    text-transform: uppercase;
    color: var(--kapa-ink-muted);
  }

  .table-head span:not(:first-child) {
    text-align: right;
  }
}

.list {
  list-style: none;
  margin: 0 0 var(--kapa-space-5);
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
}

.list li.archived {
  opacity: 0.6;
}

.list li.selected .row-card {
  border-color: var(--kapa-accent-600);
}

.row-card.clickable {
  cursor: pointer;
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
  flex-wrap: wrap;
  gap: var(--kapa-space-2);
  margin-top: var(--kapa-space-2);
}

.swatch-choice--lg {
  width: 26px;
  height: 26px;
}

.swatch-choice[aria-pressed='true'] {
  outline: 2px solid var(--kapa-accent-600);
  outline-offset: 1px;
}

.category-col {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--kapa-space-2);
}

.name-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.name {
  font-weight: 600;
}

.count {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}

.count--desktop {
  display: none;
}

.amount {
  white-space: nowrap;
}

.share-col {
  display: none;
  align-items: center;
  gap: var(--kapa-space-2);
  min-width: 140px;
}

.share-col .share-bar {
  flex: 1;
}

.share-pct {
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
  min-width: 2.5em;
  text-align: right;
}

@media (min-width: 760px) {
  .count--mobile {
    display: none;
  }

  .count--desktop {
    display: inline;
    text-align: right;
  }

  .share-col {
    display: flex;
  }

  .row-content {
    display: grid;
    grid-template-columns: 1fr 150px 130px 140px 52px;
    align-items: center;
  }

  .amount {
    text-align: right;
  }
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

.detail-panel {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-3);
  background: var(--kapa-neutral-100);
}

.detail-actions {
  display: flex;
  gap: var(--kapa-space-2);
}

.archive-note {
  background: var(--kapa-accent-100);
}

.archive-note h3 {
  margin: 0 0 var(--kapa-space-1);
}

.archive-note p {
  margin: 0;
  font-size: var(--kapa-text-caption-size);
  color: var(--kapa-ink-muted);
}
</style>
