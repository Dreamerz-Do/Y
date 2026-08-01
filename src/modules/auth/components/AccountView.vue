<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import type { HandoverBoard } from '@/modules/auth/api/authRepository'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'

// Account screen: sign out, and delete the account as a real feature (spec 8,
// a Play-Store requirement). Deletion is permanent and is confirmed with an
// explicit message naming what disappears (spec 4.5).
//
// Boards the user solely owns while others remain can't just vanish, so before
// the final confirmation we ask them to nominate a successor for each (spec
// 4.5, resolved question 1). Solo boards are deleted automatically by the RPC.
const session = useSessionStore()
const router = useRouter()

const email = computed(() => session.user?.email ?? '')
const busy = ref(false)
const error = ref('')

// Successor picking, then the final confirmation.
const handoverBoards = ref<HandoverBoard[]>([])
const receivers = ref<Record<string, string>>({})
const picking = ref(false)
const confirming = ref(false)

const allChosen = computed(() =>
  handoverBoards.value.every((b) => Boolean(receivers.value[b.boardId])),
)

async function signOut(): Promise<void> {
  await session.signOut()
  await router.replace('/login')
}

// First step of deletion: find boards that need a successor. If there are any,
// ask; otherwise go straight to the final confirmation.
async function beginDelete(): Promise<void> {
  error.value = ''
  busy.value = true
  try {
    const boards = await session.boardsAwaitingHandover()
    if (boards.length) {
      handoverBoards.value = boards
      // Pre-select the first candidate per board so a choice is always made.
      receivers.value = Object.fromEntries(
        boards.map((b) => [b.boardId, b.candidates[0]?.membershipId ?? '']),
      )
      picking.value = true
    } else {
      confirming.value = true
    }
  } catch {
    error.value = 'Er ging iets mis. Probeer het opnieuw.'
  } finally {
    busy.value = false
  }
}

function proceedFromHandover(): void {
  picking.value = false
  confirming.value = true
}

async function deleteAccount(): Promise<void> {
  confirming.value = false
  error.value = ''
  busy.value = true
  try {
    await session.deleteAccount({ ...receivers.value })
    await router.replace('/login')
  } catch {
    // The successor picking should prevent the sole-owner refusal, so any error
    // here is unexpected. Name no other user's data.
    error.value = 'Verwijderen is niet gelukt. Probeer het opnieuw.'
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
        @click="beginDelete"
      >
        {{ busy ? 'Bezig…' : 'Account verwijderen' }}
      </button>
      <p class="mt-2 text-meta text-muted">
        Alles wat je hebt aangemaakt wordt permanent verwijderd. Toewijzingen aan jou vervallen.
      </p>
    </main>

    <!-- Successor picker: for each board only you own, choose who inherits it. -->
    <template v-if="picking">
      <div class="absolute inset-0" :style="{ background: 'var(--color-overlay)' }" @click="picking = false"></div>
      <div
        class="absolute inset-x-0 bottom-0 flex max-h-[90dvh] flex-col gap-4 overflow-y-auto rounded-t-sheet bg-bg px-5 pb-7 pt-4 shadow-lg"
        role="dialog"
        aria-label="Eigenaarschap overdragen"
      >
        <div>
          <h2 class="text-title font-medium text-text">Eigenaarschap overdragen</h2>
          <p class="mt-1 text-body2 text-muted">
            Van deze boards ben jij de enige eigenaar. Kies wie eigenaar wordt voordat je je
            account verwijdert. Je gedeelde items gaan naar de nieuwe eigenaar; je privé-items
            worden verwijderd.
          </p>
        </div>

        <label v-for="b in handoverBoards" :key="b.boardId" class="flex flex-col gap-1.5">
          <span class="text-label font-medium text-muted">{{ b.boardName }}</span>
          <select
            v-model="receivers[b.boardId]"
            class="h-12 rounded-card border border-border bg-surface px-3 text-body text-text"
            :aria-label="`Nieuwe eigenaar voor ${b.boardName}`"
          >
            <option v-for="c in b.candidates" :key="c.membershipId" :value="c.membershipId">
              {{ c.name }}
            </option>
          </select>
        </label>

        <button
          type="button"
          class="h-[52px] shrink-0 rounded-card bg-accent text-lg font-medium text-accent-text disabled:opacity-50"
          :disabled="!allChosen"
          @click="proceedFromHandover"
        >
          Doorgaan
        </button>
      </div>
    </template>

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
