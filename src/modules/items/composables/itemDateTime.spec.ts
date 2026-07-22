import { describe, it, expect } from 'vitest'
import { toUtcIso, splitIso, allDayRange, todayInZone } from './itemDateTime'

// Europe/Amsterdam is UTC+1 in winter and UTC+2 in summer (DST). These tests
// pin the conversion so it stays correct regardless of the machine's own zone.

describe('toUtcIso', () => {
  it('converts a winter wall time at UTC+1', () => {
    // Arrange
    const date = '2026-01-15'
    const time = '09:00'

    // Act
    const iso = toUtcIso(date, time)

    // Assert
    expect(iso).toBe('2026-01-15T08:00:00.000Z')
  })

  it('converts a summer wall time at UTC+2', () => {
    // Arrange
    const date = '2026-07-15'
    const time = '09:00'

    // Act
    const iso = toUtcIso(date, time)

    // Assert
    expect(iso).toBe('2026-07-15T07:00:00.000Z')
  })
})

describe('splitIso', () => {
  it('is the inverse of toUtcIso across DST', () => {
    // Arrange
    const iso = toUtcIso('2026-07-15', '17:45')

    // Act
    const parts = splitIso(iso)

    // Assert
    expect(parts).toEqual({ date: '2026-07-15', time: '17:45' })
  })
})

describe('allDayRange', () => {
  it('spans the whole local day', () => {
    // Arrange
    const date = '2026-07-15'

    // Act
    const range = allDayRange(date)

    // Assert
    expect(splitIso(range.startsAt).time).toBe('00:00')
    expect(splitIso(range.endsAt).time).toBe('23:59')
  })
})

describe('todayInZone', () => {
  it('reads the calendar date in the fixed zone', () => {
    // Arrange
    const justAfterMidnightLocal = new Date('2026-07-15T22:30:00.000Z') // 00:30 CEST next day

    // Act
    const date = todayInZone(justAfterMidnightLocal)

    // Assert
    expect(date).toBe('2026-07-16')
  })
})
