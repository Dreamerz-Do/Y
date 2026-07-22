/**
 * Date/time helpers for the item editor. The app serves one household in
 * Western Europe (spec: all infrastructure in Western Europe), so wall-clock
 * input is interpreted in a single fixed zone and stored as UTC. A per-user
 * timezone is a later refinement; fixing it here keeps conversion deterministic
 * and testable, independent of the machine the tests run on.
 */

export const TIME_ZONE = 'Europe/Amsterdam'

/** The offset (zone − UTC) in milliseconds at a given instant, DST-aware. */
function zoneOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const map: Record<string, number> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = Number(p.value)
  // Intl can report hour 24 for midnight; normalise it to 0.
  const hour = map.hour === 24 ? 0 : map.hour
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second)
  return asUtc - utcMs
}

/**
 * Turn a wall-clock date (yyyy-mm-dd) and time (HH:mm) in TIME_ZONE into a UTC
 * ISO string. DST is handled: the same 09:00 is a different UTC instant in
 * summer and winter.
 */
export function toUtcIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  // Interpret the wall time as if it were UTC, then correct by the zone offset
  // that applies at that instant.
  const provisional = Date.UTC(y, mo - 1, d, h, mi)
  const offset = zoneOffsetMs(provisional, TIME_ZONE)
  return new Date(provisional - offset).toISOString()
}

/** Split a UTC ISO string back into a { date, time } pair in TIME_ZONE. */
export function splitIso(iso: string): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(iso))
  const map: Record<string, string> = {}
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value
  const hour = map.hour === '24' ? '00' : map.hour
  return { date: `${map.year}-${map.month}-${map.day}`, time: `${hour}:${map.minute}` }
}

/**
 * The start/end of an all-day item on a given date, as UTC instants covering
 * the whole local day (00:00 to 23:59 in TIME_ZONE).
 */
export function allDayRange(date: string): { startsAt: string; endsAt: string } {
  return { startsAt: toUtcIso(date, '00:00'), endsAt: toUtcIso(date, '23:59') }
}

/** Today's date in TIME_ZONE as yyyy-mm-dd — the sensible default for a new dated item. */
export function todayInZone(now: Date = new Date()): string {
  return splitIso(now.toISOString()).date
}
