import { describe, it, expect } from 'vitest'
import { itemColorCss, memberColorCss, hueFromId, ITEM_COLORS } from './palette'

describe('itemColorCss', () => {
  it('returns an oklch string for a known key', () => {
    // Arrange
    const key = 'blue'

    // Act
    const css = itemColorCss(key)

    // Assert
    expect(css).toBe('oklch(64% 0.16 210)')
  })

  it('covers every key in the fixed palette', () => {
    // Arrange
    const keys = ITEM_COLORS.map((c) => c.key)

    // Act
    const results = keys.map((k) => itemColorCss(k))

    // Assert
    expect(results.every((r) => r.startsWith('oklch('))).toBe(true)
  })
})

describe('memberColorCss', () => {
  it('places the hue in the oklch string', () => {
    // Arrange
    const hue = 255

    // Act
    const css = memberColorCss(hue)

    // Assert
    expect(css).toBe('oklch(60% 0.14 255)')
  })
})

describe('hueFromId', () => {
  it('is deterministic for the same id', () => {
    // Arrange
    const id = 'user-123'

    // Act
    const a = hueFromId(id)
    const b = hueFromId(id)

    // Assert
    expect(a).toBe(b)
  })

  it('stays within the hue circle', () => {
    // Arrange
    const id = 'another-user'

    // Act
    const hue = hueFromId(id)

    // Assert
    expect(hue).toBeGreaterThanOrEqual(0)
    expect(hue).toBeLessThan(360)
  })
})
