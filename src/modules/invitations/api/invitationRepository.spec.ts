import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Tables } from '@/shared/types/database'

// Chainable, thenable builder plus an rpc spy, so the invite/accept flow can be
// asserted without a live database.
const calls: {
  table?: string
  eq: Array<[string, unknown]>
  update?: unknown
  deleted?: boolean
  rpc?: { name: string; params: unknown }
} = { eq: [] }
let resolved: { data: unknown; error: unknown } = { data: [], error: null }

function builder() {
  const chain: Record<string, unknown> = {}
  const passthrough = () => chain
  chain.select = passthrough
  chain.order = () => Promise.resolve(resolved)
  chain.eq = (col: string, val: unknown) => {
    calls.eq.push([col, val])
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
    rpc: (name: string, params: unknown) => {
      calls.rpc = { name, params }
      return Promise.resolve({ data: null, error: null })
    },
  },
}))

import { invitationRepository, mapInvitation, mapPending } from './invitationRepository'

function makeRow(overrides: Partial<Tables<'invitations'>> = {}): Tables<'invitations'> {
  return {
    id: 'inv1',
    board_id: 'b1',
    email: 'laura@example.com',
    role: 'member',
    status: 'pending',
    invited_by: 'u1',
    created_at: '2026-04-01T00:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  calls.table = undefined
  calls.eq = []
  calls.update = undefined
  calls.deleted = undefined
  calls.rpc = undefined
  resolved = { data: [], error: null }
})

describe('mapInvitation', () => {
  it('maps snake_case columns to the domain invitation', () => {
    // Arrange
    const row = makeRow()

    // Act
    const invitation = mapInvitation(row)

    // Assert
    expect(invitation).toEqual({
      id: 'inv1',
      boardId: 'b1',
      email: 'laura@example.com',
      role: 'member',
      status: 'pending',
    })
  })
})

describe('mapPending', () => {
  it('falls back to a placeholder board name when null', () => {
    // Arrange
    const row = { id: 'inv1', board_id: 'b1', board_name: null, role: 'guest' as const, created_at: null }

    // Act
    const pending = mapPending(row)

    // Assert
    expect(pending).toMatchObject({ id: 'inv1', boardId: 'b1', boardName: 'Onbekend board', role: 'guest' })
  })
})

describe('invitationRepository.listForBoard', () => {
  it('scopes the query to the given board', async () => {
    // Arrange
    resolved = { data: [makeRow()], error: null }

    // Act
    await invitationRepository.listForBoard('b1')

    // Assert
    expect(calls.table).toBe('invitations')
    expect(calls.eq).toContainEqual(['board_id', 'b1'])
  })
})

describe('invitationRepository.create', () => {
  it('invites through the create_invitation RPC', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await invitationRepository.create('b1', 'laura@example.com', 'guest')

    // Assert
    expect(calls.rpc).toEqual({
      name: 'create_invitation',
      params: { b: 'b1', target_email: 'laura@example.com', target_role: 'guest' },
    })
  })
})

describe('invitationRepository.accept', () => {
  it('accepts through the accept_invitation RPC', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await invitationRepository.accept('inv1')

    // Assert
    expect(calls.rpc).toEqual({ name: 'accept_invitation', params: { inv: 'inv1' } })
  })
})

describe('invitationRepository.decline', () => {
  it('sets the invitation status to declined', async () => {
    // Arrange
    resolved = { data: null, error: null }

    // Act
    await invitationRepository.decline('inv1')

    // Assert
    expect(calls.update).toEqual({ status: 'declined' })
    expect(calls.eq).toContainEqual(['id', 'inv1'])
  })
})
