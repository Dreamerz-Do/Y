import { describe, it, expect, vi, beforeEach } from 'vitest'

// A chainable builder mock (thenable) recording table, filters and payloads,
// so group management can be asserted without a live database.
const calls: {
  table?: string
  eq: Array<[string, unknown]>
  insert?: unknown
  update?: unknown
  deleted?: boolean
} = { eq: [] }
let resolved: { data: unknown; error: unknown } = { data: [], error: null }

function builder() {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain
  chain.select = passthrough
  chain.order = () => Promise.resolve(resolved)
  chain.single = () => Promise.resolve(resolved)
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val])
    return chain
  }
  chain.insert = (payload: unknown) => {
    calls.insert = payload
    return chain
  }
  chain.update = (payload: unknown) => {
    calls.update = payload
    return chain
  }
  chain.delete = () => {
    calls.deleted = true
    return chain
  }
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled)
  return chain
}

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      calls.table = table
      return builder()
    },
  },
}))

import { groupRepository, mapGroup } from './groupRepository'

beforeEach(() => {
  calls.table = undefined
  calls.eq = []
  calls.insert = undefined
  calls.update = undefined
  calls.deleted = undefined
  resolved = { data: [], error: null }
})

describe('mapGroup', () => {
  it('flattens the joined membership ids', () => {
    // Arrange
    const row = {
      id: 'g1',
      board_id: 'b1',
      name: 'Ouders',
      created_at: '2026-04-01T00:00:00Z',
      group_members: [{ membership_id: 'm1' }, { membership_id: 'm2' }],
    }

    // Act
    const group = mapGroup(row)

    // Assert
    expect(group).toEqual({ id: 'g1', boardId: 'b1', name: 'Ouders', memberIds: ['m1', 'm2'] })
  })

  it('yields an empty member list when the join is null', () => {
    // Arrange
    const row = {
      id: 'g1',
      board_id: 'b1',
      name: 'Ouders',
      created_at: '2026-04-01T00:00:00Z',
      group_members: null,
    }

    // Act
    const group = mapGroup(row)

    // Assert
    expect(group.memberIds).toEqual([])
  })
})

describe('groupRepository.listByBoard', () => {
  it('scopes the query to the given board', async () => {
    // Arrange
    resolved = { data: [], error: null }

    // Act
    await groupRepository.listByBoard('b1')

    // Assert
    expect(calls.table).toBe('groups')
    expect(calls.eq).toContainEqual(['board_id', 'b1'])
  })
})

describe('groupRepository.setMembers', () => {
  it('clears the old rows before inserting the new membership', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await groupRepository.setMembers('g1', ['m1', 'm2'])

    // Assert
    expect(calls.deleted).toBe(true)
    expect(calls.insert).toEqual([
      { group_id: 'g1', membership_id: 'm1' },
      { group_id: 'g1', membership_id: 'm2' },
    ])
  })

  it('does not insert when the group is emptied', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await groupRepository.setMembers('g1', [])

    // Assert
    expect(calls.deleted).toBe(true)
    expect(calls.insert).toBeUndefined()
  })
})
