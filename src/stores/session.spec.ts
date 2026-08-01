import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const signUp = vi.fn()
const deleteAccount = vi.fn()
const boardsAwaitingHandover = vi.fn()

vi.mock('@/modules/auth/api/authRepository', () => ({
  authRepository: {
    signUp: (e: string, p: string, n: string) => signUp(e, p, n),
    deleteAccount: (h: Record<string, string>) => deleteAccount(h),
    boardsAwaitingHandover: () => boardsAwaitingHandover(),
  },
}))

import { useSessionStore } from './session'

beforeEach(() => {
  setActivePinia(createPinia())
  signUp.mockReset()
  deleteAccount.mockReset().mockResolvedValue(undefined)
  boardsAwaitingHandover.mockReset().mockResolvedValue([])
})

describe('useSessionStore.signUp', () => {
  it('signs the user in and reports true when a session starts', async () => {
    // Arrange
    signUp.mockResolvedValue({ id: 'u1', email: 'a@b.nl' })
    const store = useSessionStore()

    // Act
    const signedIn = await store.signUp('a@b.nl', 'password12', 'Jeffrey')

    // Assert
    expect(signedIn).toBe(true)
    expect(store.isAuthenticated).toBe(true)
  })

  it('reports false and stays signed out when confirmation is required', async () => {
    // Arrange
    signUp.mockResolvedValue(null)
    const store = useSessionStore()

    // Act
    const signedIn = await store.signUp('a@b.nl', 'password12', 'Jeffrey')

    // Assert
    expect(signedIn).toBe(false)
    expect(store.isAuthenticated).toBe(false)
  })
})

describe('useSessionStore.deleteAccount', () => {
  it('clears the session after deletion', async () => {
    // Arrange
    const store = useSessionStore()
    store.user = { id: 'u1', email: 'a@b.nl' }

    // Act
    await store.deleteAccount()

    // Assert
    expect(deleteAccount).toHaveBeenCalled()
    expect(store.user).toBeNull()
  })

  it('passes the successor map through to the repository', async () => {
    // Arrange
    const store = useSessionStore()
    store.user = { id: 'u1', email: 'a@b.nl' }
    const handovers = { 'board-1': 'mem-2' }

    // Act
    await store.deleteAccount(handovers)

    // Assert
    expect(deleteAccount).toHaveBeenCalledWith(handovers)
  })
})
