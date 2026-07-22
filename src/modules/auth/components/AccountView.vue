<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'

// Account screen: sign out, and delete the account as a real feature (spec 8,
// a Play-Store requirement). Deletion is permanent and is confirmed with an
// explicit message naming what disappears (spec 4.5).
const session = useSessionStore()
const router = useRouter()

const email = computed(() => session.user?.email ?? '')
const confirming = ref(false)
const busy = ref(false)
const error = ref('')

async function signOut(): Promise<void> {
  await session.signOut()
  await router.replace('/login')
}

async function deleteAccount(): Promise<void> {
  confirming.value = false
  error.value = ''
  busy.value = true
  try {
    await session.deleteAccount()
    await router.replace('/login')
  } catch {
    // Deletion is refused while you are the sole owner of a board (spec 4.5,
    // open question 1). The message is actionable but names no other user's data.
    error.value =
      'Verwijderen lukt niet zolang je de enige eigenaar van een board bent. Draag het eigenaarschap over of verwijder het board eerst.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="relative flex min-h-dvh flex-col">
    <header class="flex h-14 items-center gap-1 border-b border-border px-2">
      <button
        type="button"
        class="flex h-touch w-touch items-center justify-center rounded-full text-text"
        aria-label="Terug"
        @click="router.push({ name: 'boards' })"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <h1 class="flex-1 text-title font-medium">Account</h1>
    </header>

    <main class="flex-1 overflow-y-auto px-4 py-6">
      <p class="text-label font-medium text-muted">Aangemeld als</p>
      <p class="mb-8 text-body text-text">{{ email }}</p>

      <button
        type="button"
        class="mb-3 h-12 w-full rounded-card border border-border text-body font-medium text-text"
        @click="signOut"
      >
        Uitloggen
      </button>

      <p v-if="error" role="alert" class="mb-3 text-body2 text-danger">{{ error }}</p>

      <button
        type="button"
        :disabled="busy"
        class="h-12 w-full rounded-card border border-danger text-body font-medium text-danger disabled:opacity-50"
        @click="confirming = true"
      >
        {{ busy ? 'Bezig…' : 'Account verwijderen' }}
      </button>
      <p class="mt-2 text-meta text-muted">
        Alles wat je hebt aangemaakt wordt permanent verwijderd. Toewijzingen aan jou vervallen.
      </p>
    </main>

    <ConfirmDialog
      v-if="confirming"
      title="Account verwijderen?"
      message="Je account en alle items die je hebt aangemaakt worden permanent verwijderd. Toewijzingen aan jou op items van anderen vervallen. Dit kan niet ongedaan worden gemaakt."
      confirm-label="Definitief verwijderen"
      danger
      @confirm="deleteAccount"
      @cancel="confirming = false"
    />
  </div>
</template>
