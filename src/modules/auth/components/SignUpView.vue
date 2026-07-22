<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'

// Register a new account (spec 2 MVP #1). No cognitive test (spec 7.8): plain
// fields, pasting a password works. The display name seeds the profile the
// handle_new_user trigger creates.
const session = useSessionStore()
const router = useRouter()

const displayName = ref('')
const email = ref('')
const password = ref('')
const error = ref('')
const notice = ref('')
const busy = ref(false)

async function submit(): Promise<void> {
  error.value = ''
  notice.value = ''
  busy.value = true
  try {
    const signedIn = await session.signUp(email.value.trim(), password.value, displayName.value.trim())
    if (signedIn) {
      await router.replace('/')
    } else {
      // The project requires email confirmation before the first session.
      notice.value = 'Account aangemaakt. Bevestig je e-mailadres om aan te melden.'
    }
  } catch {
    // One neutral message; existence of an address is not confirmed or denied
    // (hard rule 5).
    error.value = 'Registreren mislukt. Controleer je gegevens en probeer opnieuw.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col justify-center px-6 py-10">
    <h1 class="mb-1 text-screen font-medium">Account aanmaken</h1>
    <p class="mb-8 text-body text-muted">Begin met je eigen huishouden.</p>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <label class="flex flex-col gap-1.5">
        <span class="text-label font-medium text-muted">Naam</span>
        <input
          v-model="displayName"
          type="text"
          autocomplete="name"
          required
          class="h-12 rounded-input border border-border bg-surface px-3.5 text-body text-text"
        />
      </label>

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
          autocomplete="new-password"
          required
          minlength="8"
          class="h-12 rounded-input border border-border bg-surface px-3.5 text-body text-text"
        />
      </label>

      <p v-if="error" role="alert" class="text-body2 text-danger">{{ error }}</p>
      <p v-if="notice" role="status" class="text-body2 text-muted">{{ notice }}</p>

      <button
        type="submit"
        :disabled="busy || !email || !password || !displayName"
        class="mt-2 h-[52px] rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
      >
        {{ busy ? 'Bezig…' : 'Account aanmaken' }}
      </button>
    </form>

    <p class="mt-6 text-center text-body2 text-muted">
      Heb je al een account?
      <RouterLink to="/login" class="font-medium text-accent">Inloggen</RouterLink>
    </p>
  </main>
</template>
