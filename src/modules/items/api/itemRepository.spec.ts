import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tables } from '@/shared/types/database'

// A chainable query-builder mock that records the filters and payloads applied,
// so we can assert board-scoping (hard rule 1) and mutations without a live
// database. The chain is thenable so `await`ing it (e.g. after .eq) resolves.
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
  chain.maybeSingle = () => Promise.resolve(resolved)
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
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
  },
}))

import { itemRepository, mapRow } from './itemRepository'

function makeRow(overrides: Partial<Tables<'items'>> = {}): Tables<'items'> {
  return {
    id: 'i1',
    board_id: 'b1',
    title: 'Boodschappen',
    notes: null,
    assignee_id: null,
    starts_at: null,
    ends_at: null,
    all_day: false,
    is_done: false,
    visibility: 'board',
    reveal_owner: true,
    color: null,
    created_by: 'u1',
    created_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  calls.table = undefined
  calls.eq = []
  calls.insert = undefined
  calls.update = undefined
  calls.deleted = undefined
  resolved = { data: [], error: null }
})

describe('mapRow', () => {
  it('maps a single assignee id into an array', () => {
    // Arrange
    const row = makeRow({ assignee_id: 'm2' })

    // Act
    const item = mapRow(row)

    // Assert
    expect(item.assigneeIds).toEqual(['m2'])
  })

  it('maps a null assignee to an empty array', () => {
    // Arrange
    const row = makeRow({ assignee_id: null })

    // Act
    const item = mapRow(row)

    // Assert
    expect(item.assigneeIds).toEqual([])
  })
})

describe('itemRepository.listByBoard', () => {
  it('scopes the query to the given board', async () => {
    // Arrange
    resolved = { data: [makeRow()], error: null }

    // Act
    await itemRepository.listByBoard('b1')

    // Assert
    expect(calls.table).toBe('items')
    expect(calls.eq).toContainEqual(['board_id', 'b1'])
  })

  it('throws when the database returns an error', async () => {
    // Arrange
    resolved = { data: null, error: { message: 'denied' } }

    // Act + Assert
    await expect(itemRepository.listByBoard('b1')).rejects.toBeTruthy()
  })
})

describe('itemRepository.busyBlocksByBoard', () => {
  it('reads from the content-free busy-block projection', async () => {
    // Arrange
    resolved = { data: [], error: null }

    // Act
    await itemRepository.busyBlocksByBoard('b1')

    // Assert
    expect(calls.table).toBe('calendar_busy_blocks')
    expect(calls.eq).toContainEqual(['board_id', 'b1'])
  })
})

describe('itemRepository.create', () => {
  it('stamps created_by from the authenticated user', async () => {
    // Arrange
    resolved = { data: makeRow(), error: null }

    // Act
    await itemRepository.create({ boardId: 'b1', title: 'Nieuw' })

    // Assert
    expect(calls.insert).toMatchObject({ board_id: 'b1', title: 'Nieuw', created_by: 'u1' })
  })
})

describe('itemRepository.update', () => {
  it('maps only the provided fields and scopes to the item id', async () => {
    // Arrange
    resolved = { data: makeRow({ title: 'Gewijzigd' }), error: null }

    // Act
    await itemRepository.update('i1', { title: 'Gewijzigd', visibility: 'private' })

    // Assert
    expect(calls.update).toEqual({ title: 'Gewijzigd', visibility: 'private' })
    expect(calls.eq).toContainEqual(['id', 'i1'])
  })
})

describe('itemRepository.sharesByItem', () => {
  it('splits rows into member and group targets', async () => {
    // Arrange
    resolved = {
      data: [
        { membership_id: 'm1', group_id: null },
        { membership_id: null, group_id: 'g1' },
      ],
      error: null,
    }

    // Act
    const targets = await itemRepository.sharesByItem('i1')

    // Assert
    expect(targets).toEqual({ memberIds: ['m1'], groupIds: ['g1'] })
  })
})

describe('itemRepository.replaceShares', () => {
  it('clears existing shares before inserting the new audience', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await itemRepository.replaceShares('i1', { memberIds: ['m1'], groupIds: ['g1'] })

    // Assert
    expect(calls.deleted).toBe(true)
    expect(calls.insert).toEqual([
      { item_id: 'i1', membership_id: 'm1' },
      { item_id: 'i1', group_id: 'g1' },
    ])
  })

  it('does not insert when the audience is empty', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await itemRepository.replaceShares('i1', { memberIds: [], groupIds: [] })

    // Assert
    expect(calls.deleted).toBe(true)
    expect(calls.insert).toBeUndefined()
  })
})
