<script setup lang="ts">
import { ref } from 'vue';
import { useCategories } from '@/composables/useCategories';

const { categories, loading, error, add, rename, archive, restore } = useCategories({
  includeArchived: true,
});

const newName = ref('');
const adding = ref(false);
const addError = ref<string | null>(null);
const renamingId = ref<string | null>(null);
const renameValue = ref('');
const busyId = ref<string | null>(null);

async function onAdd(): Promise<void> {
  addError.value = null;
  const name = newName.value.trim();
  if (!name) return;
  adding.value = true;
  try {
    await add(name);
    newName.value = '';
  } catch (err) {
    addError.value = err instanceof Error ? err.message : "Couldn't add that category.";
  } finally {
    adding.value = false;
  }
}

function startRename(id: string, currentName: string): void {
  renamingId.value = id;
  renameValue.value = currentName;
}

async function confirmRename(id: string): Promise<void> {
  const name = renameValue.value.trim();
  renamingId.value = null;
  if (!name) return;
  busyId.value = id;
  try {
    await rename(id, name);
  } finally {
    busyId.value = null;
  }
}

async function onArchive(id: string): Promise<void> {
  busyId.value = id;
  try {
    await archive(id);
  } finally {
    busyId.value = null;
  }
}

async function onRestore(id: string): Promise<void> {
  busyId.value = id;
  try {
    await restore(id);
  } finally {
    busyId.value = null;
  }
}
</script>

<template>
  <main class="categories">
    <h1>Categories</h1>
    <p v-if="loading && !categories.length">Loading…</p>
    <p v-else-if="error" role="alert" class="error">{{ error }}</p>

    <template v-else>
      <ul class="list">
        <li
          v-for="category in categories"
          :key="category.id"
          :class="{ archived: category.archived }"
        >
          <template v-if="renamingId === category.id">
            <input v-model="renameValue" type="text" @keyup.enter="confirmRename(category.id)" />
            <button type="button" @click="confirmRename(category.id)">Save</button>
            <button type="button" @click="renamingId = null">Cancel</button>
          </template>
          <template v-else>
            <span class="name">{{ category.name }}</span>
            <span v-if="category.archived" class="badge">Archived</span>
            <template v-if="!category.archived">
              <button
                type="button"
                :disabled="busyId === category.id"
                @click="startRename(category.id, category.name)"
              >
                Rename
              </button>
              <button
                type="button"
                :disabled="busyId === category.id"
                @click="onArchive(category.id)"
              >
                Archive
              </button>
            </template>
            <button
              v-else
              type="button"
              :disabled="busyId === category.id"
              @click="onRestore(category.id)"
            >
              Restore
            </button>
          </template>
        </li>
      </ul>

      <form class="add" @submit.prevent="onAdd">
        <label>
          New category
          <input v-model="newName" type="text" required />
        </label>
        <p v-if="addError" role="alert" class="error">{{ addError }}</p>
        <button type="submit" :disabled="adding || !newName.trim()">
          {{ adding ? 'Adding…' : 'Add category' }}
        </button>
      </form>
    </template>
  </main>
</template>

<style scoped>
.categories {
  max-width: 420px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

.list {
  list-style: none;
  margin: 0 0 1.5rem;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.list li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
}

.list li.archived {
  opacity: 0.6;
}

.name {
  flex: 1;
}

.badge {
  font-size: 0.75rem;
  color: var(--kapa-ink-muted);
}

.list button {
  font: inherit;
  font-size: 0.85rem;
  padding: 0.3rem 0.6rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: transparent;
  color: var(--kapa-ink);
  cursor: pointer;
}

.list input[type='text'] {
  flex: 1;
  font: inherit;
  padding: 0.3rem 0.5rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-bg);
  color: var(--kapa-ink);
}

.add {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.add label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--kapa-ink-muted);
}

.add input {
  font: inherit;
  padding: 0.5rem 0.75rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
}

.add button {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--kapa-radius-sm);
  border: none;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  cursor: pointer;
}

.add button:disabled {
  opacity: 0.6;
  cursor: default;
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
