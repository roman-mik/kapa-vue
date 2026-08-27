<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from '@/stores/session';

const session = useSessionStore();
const router = useRouter();
const route = useRoute();

const email = ref('');
const password = ref('');
const error = ref<string | null>(null);
const submitting = ref(false);

async function onSubmit(): Promise<void> {
  error.value = null;
  submitting.value = true;
  try {
    await session.signInWithPassword(email.value, password.value);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.replace(redirect);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Sign in failed.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <main class="login">
    <h1>Sign in</h1>
    <form @submit.prevent="onSubmit">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="username" required />
      </label>
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <button type="submit" :disabled="submitting">
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login {
  min-height: 100svh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: min(320px, 100%);
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: var(--kapa-ink-muted);
}

input {
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

button {
  font: inherit;
  padding: 0.5rem 1rem;
  border-radius: var(--kapa-radius-sm);
  border: none;
  background: var(--kapa-accent);
  color: var(--kapa-white);
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
