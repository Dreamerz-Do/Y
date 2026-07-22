import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tables } from '@/shared/types/database'

// Chainable, thenable builder recording table, filters and payloads, so the
// membership mutations can be asserted without a live database. Mocking the
// client has no effect on the pure mapper tests below.
const calls: { table?: string; eq: Array<[string, unknown]>; update?: unknown; deleted?: boolean } = { eq: [] }
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

import { boardRepository, mapBoard, mapMember } from './boardRepository'

beforeEach(() => {
  calls.table = undefined
  calls.eq = []
  calls.update = undefined
  calls.deleted = undefined
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
