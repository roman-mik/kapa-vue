<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSpaceStore } from '@/stores/space';

const space = useSpaceStore();
const router = useRouter();
const route = useRoute();

const inviteCode = ref('');
const joining = ref(false);
const joinError = ref<string | null>(null);
const leavingId = ref<string | null>(null);

async function goToRedirect(): Promise<void> {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  await router.replace(redirect);
}

async function onSelect(spaceId: string): Promise<void> {
  await space.selectSpace(spaceId);
  await goToRedirect();
}

async function onJoin(): Promise<void> {
  joinError.value = null;
  joining.value = true;
  try {
    await space.join(inviteCode.value.trim());
    inviteCode.value = '';
    if (space.currentSpaceId) await goToRedirect();
  } catch (err) {
    joinError.value = err instanceof Error ? err.message : "Couldn't join that space.";
  } finally {
    joining.value = false;
  }
}

async function onLeave(spaceId: string): Promise<void> {
  leavingId.value = spaceId;
  try {
    await space.leave(spaceId);
  } finally {
    leavingId.value = null;
  }
}
</script>

<template>
  <main class="spaces">
    <h1>Spaces</h1>

    <ul v-if="space.spaces.length" class="list">
      <li v-for="s in space.spaces" :key="s.id">
        <button
          type="button"
          class="space"
          :aria-pressed="space.currentSpaceId === s.id"
          @click="onSelect(s.id)"
        >
          {{ s.name }}
        </button>
        <button type="button" class="leave" :disabled="leavingId === s.id" @click="onLeave(s.id)">
          Leave
        </button>
      </li>
    </ul>
    <p v-else>You're not in any spaces yet — join one with an invite code below.</p>

    <form class="join" @submit.prevent="onJoin">
      <label>
        Invite code
        <input v-model="inviteCode" type="text" required />
      </label>
      <p v-if="joinError" role="alert" class="error">{{ joinError }}</p>
      <button type="submit" :disabled="joining || !inviteCode.trim()">
        {{ joining ? 'Joining…' : 'Join space' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.spaces {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  padding: 2rem;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: min(320px, 100%);
}

.list li {
  display: flex;
  gap: 0.5rem;
}

.space {
  flex: 1;
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
  cursor: pointer;
  text-align: left;
}

.space[aria-pressed='true'] {
  border-color: var(--kapa-accent);
  color: var(--kapa-accent-700);
  background: var(--kapa-accent-100);
}

.leave {
  font: inherit;
  padding: 0.5rem 0.75rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: transparent;
  color: var(--kapa-ink-muted);
  cursor: pointer;
}

.leave:disabled {
  opacity: 0.6;
  cursor: default;
}

.join {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(320px, 100%);
}

.join label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--kapa-ink-muted);
}

.join input {
  font: inherit;
  padding: 0.5rem 0.75rem;
  border-radius: var(--kapa-radius-sm);
  border: 1px solid var(--kapa-neutral-400);
  background: var(--kapa-surface);
  color: var(--kapa-ink);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}

.join button {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--kapa-radius-sm);
  border: none;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  cursor: pointer;
}

.join button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
