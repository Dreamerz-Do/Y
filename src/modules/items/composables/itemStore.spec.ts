import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the repository so the store is tested in isolation from Supabase.
const listByBoard = vi.fn()
const busyBlocksByBoard = vi.fn()
const create = vi.fn()
const update = vi.fn()
const remove = vi.fn()
const replaceShares = vi.fn()
const sharesByItem = vi.fn()

vi.mock('../api/itemRepository', () => ({
  itemRepository: {
    listByBoard: (id: string) => listByBoard(id),
    busyBlocksByBoard: (id: string) => busyBlocksByBoard(id),
    create: (input: unknown) => create(input),
    update: (id: string, patch: unknown) => update(id, patch),
    remove: (id: string) => remove(id),
    replaceShares: (id: string, targets: unknown) => replaceShares(id, targets),
    sharesByItem: (id: string) => sharesByItem(id),
  },
}))

import { useItemStore } from './itemStore'

beforeEach(() => {
  setActivePinia(createPinia())
  listByBoard.mockReset().mockResolvedValue([])
  busyBlocksByBoard.mockReset().mockResolvedValue([])
  create.mockReset().mockResolvedValue({ id: 'new-item' })
  update.mockReset().mockResolvedValue({ id: 'i1' })
  remove.mockReset().mockResolvedValue(undefined)
  replaceShares.mockReset().mockResolvedValue(undefined)
  sharesByItem.mockReset().mockResolvedValue({ memberIds: [], groupIds: [] })
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

describe('useItemStore.add', () => {
  it('does not write shares for a board-wide item', async () => {
    // Arrange
    const store = useItemStore()

    // Act
    await store.add({ boardId: 'b1', title: 'X', visibility: 'board' })

    // Assert
    expect(replaceShares).not.toHaveBeenCalled()
  })

  it('writes the audience for a shared_with item', async () => {
    // Arrange
    const store = useItemStore()

    // Act
    await store.add(
      { boardId: 'b1', title: 'X', visibility: 'shared_with' },
      { memberIds: ['m1'], groupIds: [] },
    )

    // Assert
    expect(replaceShares).toHaveBeenCalledWith('new-item', { memberIds: ['m1'], groupIds: [] })
  })
})

describe('useItemStore.update', () => {
  it('clears shares when an item moves away from shared_with', async () => {
    // Arrange
    const store = useItemStore()

    // Act
    await store.update('b1', 'i1', { visibility: 'private' }, { memberIds: ['m1'], groupIds: [] })

    // Assert
    expect(replaceShares).toHaveBeenCalledWith('i1', { memberIds: [], groupIds: [] })
  })

  it('leaves shares untouched when visibility is not part of the patch', async () => {
    // Arrange
    const store = useItemStore()

    // Act
    await store.update('b1', 'i1', { title: 'Nieuwe titel' })

    // Assert
    expect(replaceShares).not.toHaveBeenCalled()
  })
})

describe('useItemStore.remove', () => {
  it('deletes the item then reloads the board', async () => {
    // Arrange
    const store = useItemStore()

    // Act
    await store.remove('b1', 'i1')

    // Assert
    expect(remove).toHaveBeenCalledWith('i1')
    expect(listByBoard).toHaveBeenCalledWith('b1')
  })
})
