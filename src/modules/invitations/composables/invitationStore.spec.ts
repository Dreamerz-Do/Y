import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the repository so the store is tested in isolation from Supabase.
const listMine = vi.fn()
const listForBoard = vi.fn()
const create = vi.fn()
const accept = vi.fn()
const decline = vi.fn()
const remove = vi.fn()

vi.mock('../api/invitationRepository', () => ({
  invitationRepository: {
    listMine: () => listMine(),
    listForBoard: (id: string) => listForBoard(id),
    create: (b: string, e: string, r: string) => create(b, e, r),
    accept: (id: string) => accept(id),
    decline: (id: string) => decline(id),
    remove: (id: string) => remove(id),
  },
}))

import { useInvitationStore } from './invitationStore'

beforeEach(() => {
  setActivePinia(createPinia())
  listMine.mockReset().mockResolvedValue([])
  listForBoard.mockReset().mockResolvedValue([])
  create.mockReset().mockResolvedValue(undefined)
  accept.mockReset().mockResolvedValue(undefined)
  decline.mockReset().mockResolvedValue(undefined)
  remove.mockReset().mockResolvedValue(undefined)
})

describe('useInvitationStore.invite', () => {
  it('creates the invitation then reloads that board only', async () => {
    // Arrange
    const store = useInvitationStore()

    // Act
    await store.invite('b1', 'laura@example.com', 'member')

    // Assert
    expect(create).toHaveBeenCalledWith('b1', 'laura@example.com', 'member')
    expect(listForBoard).toHaveBeenCalledWith('b1')
  })
})

describe('useInvitationStore.accept', () => {
  it('accepts then refetches the caller\'s own invitations', async () => {
    // Arrange
    const store = useInvitationStore()

    // Act
    await store.accept('inv1')

    // Assert
    expect(accept).toHaveBeenCalledWith('inv1')
    expect(listMine).toHaveBeenCalled()
  })
})

describe('useInvitationStore.invitationsOf', () => {
  it('keeps each board\'s invitations under its own key', async () => {
    // Arrange
    const store = useInvitationStore()
    listForBoard.mockResolvedValueOnce([
      { id: 'inv1', boardId: 'b1', email: 'x@y.nl', role: 'member', status: 'pending' },
    ])

    // Act
    await store.loadForBoard('b1')

    // Assert
    expect(store.invitationsOf('b1')).toHaveLength(1)
    expect(store.invitationsOf('b2')).toEqual([])
  })
})
