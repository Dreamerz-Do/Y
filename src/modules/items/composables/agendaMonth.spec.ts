import { describe, it, expect } from 'vitest'
import {
  monthMatrix,
  monthLabel,
  addMonth,
  addDays,
  daysInMonth,
  localDay,
  ymd,
} from './agendaMonth'

describe('daysInMonth', () => {
  it('counts the days in a month, leap year included', () => {
    // Arrange
    const cases: [number, number, number][] = [
      [2026, 4, 30],
      [2026, 2, 28],
      [2028, 2, 29],
    ]

    // Act
    const counts = cases.map(([y, m]) => daysInMonth(y, m))

    // Assert
    expect(counts).toEqual([30, 28, 29])
  })
})

describe('monthMatrix', () => {
  it('produces whole Monday-first weeks covering the month', () => {
    // Arrange
    const year = 2026
    const month = 4

    // Act
    const cells = monthMatrix(year, month)

    // Assert
    expect(cells.length % 7).toBe(0)
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30)
  })

  it('pads the lead with the previous month so day 1 sits on its weekday', () => {
    // Arrange — 2026-04-01 is a Wednesday, so two lead days (Mon, Tue).
    const cells = monthMatrix(2026, 4)

    // Act
    const firstInMonth = cells.findIndex((c) => c.inMonth)

    // Assert
    expect(firstInMonth).toBe(2)
    expect(cells[0]).toEqual({ iso: '2026-03-30', day: 30, inMonth: false })
    expect(cells[2]).toEqual({ iso: '2026-04-01', day: 1, inMonth: true })
  })
})

describe('monthLabel', () => {
  it('names the month in Dutch with the year', () => {
    // Arrange
    const year = 2026
    const month = 4

    // Act
    const label = monthLabel(year, month)

    // Assert
    expect(label).toBe('april 2026')
  })
})

describe('addMonth', () => {
  it('wraps forward across the year boundary', () => {
    // Arrange
    const start = { year: 2026, month: 12 }

    // Act
    const next = addMonth(start.year, start.month, 1)

    // Assert
    expect(next).toEqual({ year: 2027, month: 1 })
  })

  it('wraps backward across the year boundary', () => {
    // Arrange
    const start = { year: 2026, month: 1 }

    // Act
    const prev = addMonth(start.year, start.month, -1)

    // Assert
    expect(prev).toEqual({ year: 2025, month: 12 })
  })
})

describe('addDays', () => {
  it('crosses a month boundary', () => {
    // Arrange
    const iso = '2026-04-28'

    // Act
    const later = addDays(iso, 7)

    // Assert
    expect(later).toBe('2026-05-05')
  })
})

describe('localDay', () => {
  it('reports the household-zone day of an instant', () => {
    // Arrange — 21:30 UTC is 23:30 in Amsterdam summer time, still the 1st.
    const iso = '2026-07-01T21:30:00.000Z'

    // Act
    const day = localDay(iso)

    // Assert
    expect(day).toBe('2026-07-01')
  })
})

describe('ymd', () => {
  it('zero-pads month and day', () => {
    // Arrange
    const parts: [number, number, number] = [2026, 3, 5]

    // Act
    const iso = ymd(...parts)

    // Assert
    expect(iso).toBe('2026-03-05')
  })
})
