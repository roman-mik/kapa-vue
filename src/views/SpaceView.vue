<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
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
        <BaseButton variant="ghost" :disabled="leavingId === s.id" @click="onLeave(s.id)">
          Leave
        </BaseButton>
      </li>
    </ul>
    <p v-else>You're not in any spaces yet — join one with an invite code below.</p>

    <form class="join" @submit.prevent="onJoin">
      <BaseField label="Invite code" v-slot="{ id }">
        <BaseInput :id="id" v-model="inviteCode" type="text" required />
      </BaseField>
      <p v-if="joinError" role="alert" class="error">{{ joinError }}</p>
      <BaseButton type="submit" block :disabled="joining || !inviteCode.trim()">
        {{ joining ? 'Joining…' : 'Join space' }}
      </BaseButton>
    </form>
  </main>
</template>

<style scoped>
.spaces {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--kapa-space-5);
  padding: var(--kapa-space-6);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-2);
  width: min(320px, 100%);
}

.list li {
  display: flex;
  gap: var(--kapa-space-2);
}

.space {
  flex: 1;
  font: inherit;
  padding: var(--kapa-space-3) var(--kapa-space-4);
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

.join {
  display: flex;
  flex-direction: column;
  gap: var(--kapa-space-4);
  width: min(320px, 100%);
}

.error {
  color: var(--kapa-negative);
  margin: 0;
}
</style>
