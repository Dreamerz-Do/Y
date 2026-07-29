import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tables } from '@/shared/types/database'

// Chainable, thenable builder recording table, filters and payloads, so the
// membership mutations can be asserted without a live database. Mocking the
// client has no effect on the pure mapper tests below.
const calls: {
  table?: string
  eq: Array<[string, unknown]>
  update?: unknown
  deleted?: boolean
  rpc?: { name: string; args: unknown }
} = { eq: [] }
let resolved: { data: unknown; error: unknown } = { data: [], error: null }

function builder() {
  const chain: Record<string, unknown> = {}
  chain.update = (payload: unknown) => {
    calls.update = payload
    return chain
  }
  chain.delete = () => {
    calls.deleted = true
    return chain
  }
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val])
    return chain
  }
  chain.select = () => chain
  chain.single = () => chain
  chain.maybeSingle = () => chain
  chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolved).then(onFulfilled)
  return chain
}

vi.mock('@/shared/lib/supabaseClient', () => ({
  supabase: {
    from: (table: string) => {
      calls.table = table
      return builder()
    },
    rpc: (name: string, args: unknown) => {
      calls.rpc = { name, args }
      return Promise.resolve(resolved)
    },
  },
}))

import { boardRepository, mapBoard, mapMember } from './boardRepository'

beforeEach(() => {
  calls.table = undefined
  calls.eq = []
  calls.update = undefined
  calls.deleted = undefined
  calls.rpc = undefined
  resolved = { data: [], error: null }
})

describe('mapBoard', () => {
  it('maps snake_case columns to the domain board', () => {
    // Arrange
    const row: Tables<'boards'> = {
      id: 'b1',
      name: 'Huishouden',
      accent_hue: 215,
      default_visibility: 'board',
      created_by: 'u1',
      created_at: '2026-04-01T00:00:00Z',
    }

    // Act
    const board = mapBoard(row)

    // Assert
    expect(board).toEqual({
      id: 'b1',
      name: 'Huishouden',
      accentHue: 215,
      defaultVisibility: 'board',
      createdBy: 'u1',
    })
  })
})

describe('mapMember', () => {
  it('uses the profile display name and colour hue', () => {
    // Arrange
    const row = {
      id: 'm1',
      user_id: 'u1',
      role: 'owner' as const,
      profiles: { display_name: 'Jeffrey', color_hue: 255 },
    }

    // Act
    const member = mapMember(row)

    // Assert
    expect(member).toMatchObject({ membershipId: 'm1', name: 'Jeffrey', role: 'owner', hue: 255 })
  })

  it('falls back to a derived hue and placeholder name when the profile is missing', () => {
    // Arrange
    const row = { id: 'm2', user_id: 'u2', role: 'guest' as const, profiles: null }

    // Act
    const member = mapMember(row)

    // Assert
    expect(member.name).toBe('Onbekend')
    expect(member.hue).toBeGreaterThanOrEqual(0)
    expect(member.hue).toBeLessThan(360)
  })
})

describe('boardRepository.create', () => {
  it('creates the board through the create_board RPC and maps the returned row', async () => {
    // Arrange — the database generates the id and returns the full row.
    resolved = {
      data: {
        id: 'db-generated',
        name: 'Huishouden',
        accent_hue: 215,
        default_visibility: 'board',
        created_by: 'u1',
        created_at: '2026-04-01T00:00:00Z',
      },
      error: null,
    }

    // Act
    const board = await boardRepository.create('Huishouden', 215)

    // Assert
    expect(calls.rpc).toEqual({
      name: 'create_board',
      args: { board_name: 'Huishouden', accent: 215 },
    })
    expect(board).toEqual({
      id: 'db-generated',
      name: 'Huishouden',
      accentHue: 215,
      defaultVisibility: 'board',
      createdBy: 'u1',
    })
  })
})

describe('boardRepository.updateRole', () => {
  it('updates the role scoped to the membership id', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await boardRepository.updateRole('m1', 'member')

    // Assert
    expect(calls.table).toBe('memberships')
    expect(calls.update).toEqual({ role: 'member' })
    expect(calls.eq).toContainEqual(['id', 'm1'])
  })
})

describe('boardRepository.removeMember', () => {
  it('deletes the membership by id', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await boardRepository.removeMember('m1')

    // Assert
    expect(calls.table).toBe('memberships')
    expect(calls.deleted).toBe(true)
    expect(calls.eq).toContainEqual(['id', 'm1'])
  })
})

describe('boardRepository.update', () => {
  it('maps the patch to columns, scopes to the id, and returns the mapped board', async () => {
    // Arrange
    resolved = {
      data: {
        id: 'b1',
        name: 'Nieuw',
        accent_hue: 260,
        default_visibility: 'private',
        created_by: 'u1',
        created_at: '2026-04-01T00:00:00Z',
      },
      error: null,
    }

    // Act
    const board = await boardRepository.update('b1', {
      name: 'Nieuw',
      accentHue: 260,
      defaultVisibility: 'private',
    })

    // Assert
    expect(calls.table).toBe('boards')
    expect(calls.update).toEqual({ name: 'Nieuw', accent_hue: 260, default_visibility: 'private' })
    expect(calls.eq).toContainEqual(['id', 'b1'])
    expect(board).toMatchObject({ id: 'b1', name: 'Nieuw', accentHue: 260, defaultVisibility: 'private' })
  })
})

describe('boardRepository.remove', () => {
  it('deletes the board by id', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await boardRepository.remove('b1')

    // Assert
    expect(calls.table).toBe('boards')
    expect(calls.deleted).toBe(true)
    expect(calls.eq).toContainEqual(['id', 'b1'])
  })
})
