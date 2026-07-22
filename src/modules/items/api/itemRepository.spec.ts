import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tables } from '@/shared/types/database'

// A chainable query-builder mock that records the filters applied, so we can
// assert board-scoping (hard rule 1) without a live database.
const calls: { table?: string; eq: Array<[string, unknown]> } = { eq: [] }
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
  chain.insert = passthrough
  chain.update = passthrough
  chain.delete = passthrough
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
