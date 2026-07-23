import { splitIso } from './itemDateTime'

/**
 * Pure helpers for the agenda month view (spec 7.6 #3). Calendar arithmetic is
 * kept free of Vue so every branch is unit-testable and independent of the
 * machine's own clock/zone. Day grouping uses the household's fixed zone
 * (TIME_ZONE) via splitIso, so an item at 23:30 local lands on the local day,
 * not the UTC one.
 */

const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
]

/** Monday-first weekday labels, matching the design. */
export const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'] as const

/** One cell in the month grid. `inMonth` is false for adjacent-month padding. */
export interface MonthCell {
  iso: string
  day: number
  inMonth: boolean
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

export function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`
}

/** Monday-first weekday index (0 = Monday … 6 = Sunday) for a calendar date. */
function weekdayMon0(year: number, month: number, day: number): number {
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7
}

/** Number of days in a 1-based month. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * The calendar grid for a month: whole weeks, Monday-first, padded with the
 * adjacent months' days so the grid is always a multiple of seven.
 */
export function monthMatrix(year: number, month: number): MonthCell[] {
  const lead = weekdayMon0(year, month, 1)
  const total = daysInMonth(year, month)
  const cells: MonthCell[] = []

  const prev = addMonth(year, month, -1)
  const prevTotal = daysInMonth(prev.year, prev.month)
  for (let i = lead - 1; i >= 0; i--) {
    const day = prevTotal - i
    cells.push({ iso: ymd(prev.year, prev.month, day), day, inMonth: false })
  }

  for (let day = 1; day <= total; day++) {
    cells.push({ iso: ymd(year, month, day), day, inMonth: true })
  }

  const next = addMonth(year, month, 1)
  let day = 1
  while (cells.length % 7 !== 0) {
    cells.push({ iso: ymd(next.year, next.month, day), day, inMonth: false })
    day++
  }
  return cells
}

/** "april 2026" — Dutch month name and year. */
export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/** Shift a 1-based year/month by a number of months, wrapping the year. */
export function addMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

/** Shift a yyyy-mm-dd date by a number of days. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return ymd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

/** The local (TIME_ZONE) yyyy-mm-dd an instant falls on. */
export function localDay(iso: string): string {
  return splitIso(iso).date
}
