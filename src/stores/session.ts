import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authRepository, type AuthedUser } from '@/modules/auth/api/authRepository'

// Client-state store: who is signed in and which board is active. It holds no
// server data (items, boards) — those live in their own domain stores
// (spec 6.4: a store holds either client state or server data, never both).
export const useSessionStore = defineStore('session', () => {
  const user = ref<AuthedUser | null>(null)
  const ready = ref(false)
  const lastBoardId = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)

  async function init(): Promise<void> {
    user.value = await authRepository.currentUser()
    ready.value = true
    authRepository.onChange((u) => {
      user.value = u
    })
  }

  async function signIn(email: string, password: string): Promise<void> {
    user.value = await authRepository.signIn(email, password)
  }

  async function signOut(): Promise<void> {
    await authRepository.signOut()
    user.value = null
    lastBoardId.value = null
  }

  function rememberBoard(boardId: string): void {
    lastBoardId.value = boardId
  }

  return { user, ready, lastBoardId, isAuthenticated, init, signIn, signOut, rememberBoard }
})
