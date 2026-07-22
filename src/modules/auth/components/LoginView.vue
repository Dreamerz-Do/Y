<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

// Sign-in without a cognitive test (spec 7.8): plain email + password, pasting
// a password works, no puzzles.
const session = useSessionStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    await session.signIn(email.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch {
    // "not found" and "no access" are indistinguishable everywhere (hard rule 5);
    // a failed sign-in gets one neutral message.
    error.value = 'Inloggen mislukt. Controleer je e-mailadres en wachtwoord.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col justify-center px-6 py-10">
    <h1 class="mb-1 text-screen font-medium">Huishouden</h1>
    <p class="mb-8 text-body text-muted">Meld je aan om verder te gaan.</p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <label class="flex flex-col gap-1.5">
        <span class="text-label font-medium text-muted">E-mailadres</span>
        <input
          v-model="email"
          type="email"
          autocomplete="email"
          required
          class="h-12 rounded-input border border-border bg-surface px-3.5 text-body text-text"
        />
      </label>

      <label class="flex flex-col gap-1.5">
        <span class="text-label font-medium text-muted">Wachtwoord</span>
        <input
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="h-12 rounded-input border border-border bg-surface px-3.5 text-body text-text"
        />
      </label>

      <p v-if="error" role="alert" class="text-body2 text-danger">{{ error }}</p>

      <button
        type="submit"
        :disabled="busy || !email || !password"
        class="mt-2 h-[52px] rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
      >
        {{ busy ? 'Bezig…' : 'Inloggen' }}
      </button>
    </form>

    <p class="mt-6 text-center text-body2 text-muted">
      Nog geen account?
      <RouterLink to="/signup" class="font-medium text-accent">Account aanmaken</RouterLink>
    </p>
  </main>
</template>
