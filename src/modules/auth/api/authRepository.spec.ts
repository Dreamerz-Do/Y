import { describe, it, expect, vi, beforeEach } from 'vitest'

const signUp = vi.fn()
const signOut = vi.fn()
const rpc = vi.fn()

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      signUp: (args: unknown) => signUp(args),
      signOut: () => signOut(),
    },
    rpc: (name: string, args?: unknown) => rpc(name, args),
  },
}))

import { authRepository } from './authRepository'

beforeEach(() => {
  signUp.mockReset()
  signOut.mockReset().mockResolvedValue({ error: null })
  rpc.mockReset().mockResolvedValue({ error: null })
})

describe('authRepository.signUp', () => {
  it('returns the user when a session starts immediately', async () => {
    // Arrange
    signUp.mockResolvedValue({
      data: { user: { id: 'u1', email: 'a@b.nl' }, session: { access_token: 't' } },
      error: null,
    })

    // Act
    const user = await authRepository.signUp('a@b.nl', 'password12', 'Jeffrey')

    // Assert
    expect(user).toEqual({ id: 'u1', email: 'a@b.nl' })
  })

  it('returns null when the address must be confirmed first', async () => {
    // Arrange
    signUp.mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.nl' }, session: null }, error: null })

    // Act
    const user = await authRepository.signUp('a@b.nl', 'password12', 'Jeffrey')

    // Assert
    expect(user).toBeNull()
  })

  it('throws when sign-up fails', async () => {
    // Arrange
    signUp.mockResolvedValue({ data: { user: null, session: null }, error: { message: 'taken' } })

    // Act + Assert
    await expect(authRepository.signUp('a@b.nl', 'password12', 'Jeffrey')).rejects.toBeTruthy()
  })
})

describe('authRepository.deleteAccount', () => {
  it('calls the delete RPC with an empty map then signs out', async () => {
    // Arrange
    rpc.mockResolvedValue({ error: null })

    // Act
    await authRepository.deleteAccount()

    // Assert
    expect(rpc).toHaveBeenCalledWith('delete_current_user', { handovers: {} })
    expect(signOut).toHaveBeenCalled()
  })

  it('forwards the successor map to the RPC', async () => {
    // Arrange
    rpc.mockResolvedValue({ error: null })

    // Act
    await authRepository.deleteAccount({ 'board-1': 'mem-2' })

    // Assert
    expect(rpc).toHaveBeenCalledWith('delete_current_user', { handovers: { 'board-1': 'mem-2' } })
  })

  it('does not sign out when the delete RPC fails', async () => {
    // Arrange
    rpc.mockResolvedValue({ error: { message: 'sole owner' } })

    // Act + Assert
    await expect(authRepository.deleteAccount()).rejects.toBeTruthy()
    expect(signOut).not.toHaveBeenCalled()
  })
})

describe('authRepository.boardsAwaitingHandover', () => {
  it('maps the RPC rows to camelCase', async () => {
    // Arrange
    rpc.mockResolvedValue({
      data: [
        {
          board_id: 'board-1',
          board_name: 'Huishouden',
          candidates: [{ membership_id: 'mem-2', name: 'Sanne' }],
        },
      ],
      error: null,
    })

    // Act
    const boards = await authRepository.boardsAwaitingHandover()

    // Assert
    expect(boards).toEqual([
      {
        boardId: 'board-1',
        boardName: 'Huishouden',
        candidates: [{ membershipId: 'mem-2', name: 'Sanne' }],
      },
    ])
  })

  it('returns an empty list when the RPC yields no rows', async () => {
    // Arrange
    rpc.mockResolvedValue({ data: null, error: null })

    // Act
    const boards = await authRepository.boardsAwaitingHandover()

    // Assert
    expect(boards).toEqual([])
  })
})
