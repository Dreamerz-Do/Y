import { describe, it, expect } from 'vitest'
import { mapBoard, mapMember } from './boardRepository'
import type { Tables } from '@/shared/types/database'

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
