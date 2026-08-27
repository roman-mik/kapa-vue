<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BaseButton from '@/components/ui/BaseButton.vue';
import BaseField from '@/components/ui/BaseField.vue';
import BaseInput from '@/components/ui/BaseInput.vue';
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
    <form class="form" @submit.prevent="onSubmit">
      <BaseField label="Email" v-slot="{ id }">
        <BaseInput :id="id" v-model="email" type="email" autocomplete="username" required />
      </BaseField>
      <BaseField label="Password" v-slot="{ id }">
        <BaseInput
          :id="id"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
        />
      </BaseField>
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <BaseButton type="submit" block :disabled="submitting">
        {{ submitting ? 'Signing in…' : 'Sign in' }}
      </BaseButton>
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
  padding: var(--kapa-space-6);
}

.form {
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
