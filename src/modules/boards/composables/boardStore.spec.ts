import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock both repositories in the boards domain so the store is tested in
// isolation from Supabase.
const list = vi.fn()
const members = vi.fn()
const updateRole = vi.fn()
const removeMember = vi.fn()
const groupList = vi.fn()
const groupCreate = vi.fn()
const groupSetMembers = vi.fn()

vi.mock('../api/boardRepository', () => ({
  boardRepository: {
    list: () => list(),
    members: (id: string) => members(id),
    updateRole: (mid: string, role: string) => updateRole(mid, role),
    removeMember: (mid: string) => removeMember(mid),
  },
}))

vi.mock('../api/groupRepository', () => ({
  groupRepository: {
    listByBoard: (id: string) => groupList(id),
    create: (b: string, n: string) => groupCreate(b, n),
    setMembers: (g: string, ids: string[]) => groupSetMembers(g, ids),
  },
}))

import { useBoardStore } from './boardStore'

beforeEach(() => {
  setActivePinia(createPinia())
  list.mockReset().mockResolvedValue([])
  members.mockReset().mockResolvedValue([])
  updateRole.mockReset().mockResolvedValue(undefined)
  removeMember.mockReset().mockResolvedValue(undefined)
  groupList.mockReset().mockResolvedValue([])
  groupCreate.mockReset().mockResolvedValue({ id: 'g1' })
  groupSetMembers.mockReset().mockResolvedValue(undefined)
})

describe('useBoardStore.changeRole', () => {
  it('updates the role then refetches that board\'s members', async () => {
    // Arrange
    const store = useBoardStore()

    // Act
    await store.changeRole('b1', 'm1', 'member')

    // Assert
    expect(updateRole).toHaveBeenCalledWith('m1', 'member')
    expect(members).toHaveBeenCalledWith('b1')
  })
})

describe('useBoardStore.leaveBoard', () => {
  it('drops the board from the local list after removing the membership', async () => {
    // Arrange
    list.mockResolvedValueOnce([
      { id: 'b1', name: 'A', accentHue: 1, defaultVisibility: 'board', createdBy: 'u1' },
      { id: 'b2', name: 'B', accentHue: 1, defaultVisibility: 'board', createdBy: 'u1' },
    ])
    const store = useBoardStore()
    await store.loadBoards()

    // Act
    await store.leaveBoard('b1', 'm1')

    // Assert
    expect(removeMember).toHaveBeenCalledWith('m1')
    expect(store.boards.map((b) => b.id)).toEqual(['b2'])
  })
})

describe('useBoardStore.setGroupMembers', () => {
  it('writes the membership then refetches groups', async () => {
    // Arrange
    const store = useBoardStore()

    // Act
    await store.setGroupMembers('b1', 'g1', ['m1', 'm2'])

    // Assert
    expect(groupSetMembers).toHaveBeenCalledWith('g1', ['m1', 'm2'])
    expect(groupList).toHaveBeenCalledWith('b1')
  })
})
