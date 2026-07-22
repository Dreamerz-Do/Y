import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the repository so the store is tested in isolation from Supabase.
const listByBoard = vi.fn()
const busyBlocksByBoard = vi.fn()

vi.mock('../api/itemRepository', () => ({
  itemRepository: {
    listByBoard: (id: string) => listByBoard(id),
    busyBlocksByBoard: (id: string) => busyBlocksByBoard(id),
  },
}))

import { useItemStore } from './itemStore'

beforeEach(() => {
  setActivePinia(createPinia())
  listByBoard.mockReset().mockResolvedValue([])
  busyBlocksByBoard.mockReset().mockResolvedValue([])
})

describe('useItemStore.load', () => {
  it('fetches items and busy blocks for the requested board only', async () => {
    // Arrange
    const store = useItemStore()

    // Act
    await store.load('board-1')

    // Assert
    expect(listByBoard).toHaveBeenCalledWith('board-1')
    expect(busyBlocksByBoard).toHaveBeenCalledWith('board-1')
  })

  it('keeps each board\'s data under its own key', async () => {
    // Arrange
    const store = useItemStore()
    listByBoard.mockResolvedValueOnce([
      { id: 'i1', boardId: 'board-1', title: 'A', notes: null, assigneeIds: [], startsAt: null, endsAt: null, allDay: false, isDone: false, visibility: 'board', revealOwner: true, color: null, createdBy: 'u1' },
    ])

    // Act
    await store.load('board-1')

    // Assert
    expect(store.itemsOf('board-1')).toHaveLength(1)
    expect(store.itemsOf('board-2')).toEqual([])
  })
})
