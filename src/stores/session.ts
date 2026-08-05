import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authRepository, type AuthedUser, type HandoverBoard } from '@/modules/auth/api/authRepository'

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

  /** Register; returns true when a session started immediately (auto sign-in),
   * false when the project still needs the address confirmed. */
  async function signUp(email: string, password: string, displayName: string): Promise<boolean> {
    const registered = await authRepository.signUp(email, password, displayName)
    user.value = registered
    return registered !== null
  }

  async function signOut(): Promise<void> {
    await authRepository.signOut()
    user.value = null
    lastBoardId.value = null
  }

  /** Boards the user solely owns while others remain, needing a successor
   * before account deletion (spec 4.5). This is a passthrough query, not stored
   * server state — the store keeps only client state. */
  function boardsAwaitingHandover(): Promise<HandoverBoard[]> {
    return authRepository.boardsAwaitingHandover()
  }

  async function deleteAccount(handovers: Record<string, string> = {}): Promise<void> {
    await authRepository.deleteAccount(handovers)
    user.value = null
    lastBoardId.value = null
  }

  function rememberBoard(boardId: string): void {
    lastBoardId.value = boardId
  }

  return {
    user,
    ready,
    lastBoardId,
    isAuthenticated,
    init,
    signIn,
    signUp,
    signOut,
    boardsAwaitingHandover,
    deleteAccount,
    rememberBoard,
  }
})
