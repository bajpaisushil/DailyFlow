import type { HHMM, LocalDate, Weekday } from '@/lib/types'

/** Parse "06:45" → minutes since local midnight. Returns null on malformed input. */
export function parseHHMM(value: HHMM): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function toHHMM(minutesSinceMidnight: number): HHMM {
  const wrapped = ((minutesSinceMidnight % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/** Local calendar day key, "YYYY-MM-DD". Local, never UTC — routines are wall-clock things. */
export function localDateKey(d: Date): LocalDate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfLocalDay(d: Date): Date {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

export function addDays(d: Date, days: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + days)
  return c
}

export function weekdayOf(d: Date): Weekday {
  return d.getDay() as Weekday
}

/**
 * Absolute timestamp for a wall-clock time on the local day containing `ref`.
 * Uses setHours so it stays correct across DST transitions.
 */
export function timestampForTimeOn(ref: Date, time: HHMM): number | null {
  const mins = parseHHMM(time)
  if (mins == null) return null
  const d = startOfLocalDay(ref)
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return d.getTime()
}

/**
 * Every local-day boundary touched by (from, to], inclusive of the days containing both ends.
 * Used so catch-up can walk each missed day when the app was closed for a long time.
 */
export function localDaysBetween(from: number, to: number, maxDays = 14): Date[] {
  const out: Date[] = []
  let cursor = startOfLocalDay(new Date(from))
  const end = startOfLocalDay(new Date(to))
  let guard = 0
  while (cursor.getTime() <= end.getTime() && guard < maxDays) {
    out.push(new Date(cursor))
    cursor = addDays(cursor, 1)
    guard += 1
  }
  return out
}

/**
 * Is `time` inside the [from, to) window? Handles windows that wrap past midnight,
 * which quiet hours (22:00 → 07:00) always do.
 */
export function isWithinWindow(nowMinutes: number, from: HHMM, to: HHMM): boolean {
  const f = parseHHMM(from)
  const t = parseHHMM(to)
  if (f == null || t == null) return false
  if (f === t) return false
  return f < t ? nowMinutes >= f && nowMinutes < t : nowMinutes >= f || nowMinutes < t
}

/** "6:45 AM" or "06:45" depending on the user's clock preference. */
export function formatTime(time: HHMM, use24h: boolean, locale = 'en'): string {
  const mins = parseHHMM(time)
  if (mins == null) return time
  const d = new Date()
  d.setHours(Math.floor(mins / 60), mins % 60, 0, 0)
  return new Intl.DateTimeFormat(locale, {
    hour: use24h ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !use24h,
  }).format(d)
}

/** Plain-word relative time — "in 10 minutes", "now", "2 hours ago". Never a raw timestamp. */
export function humanDelta(fromMs: number, toMs: number, locale = 'en'): string {
  const diffMin = Math.round((toMs - fromMs) / 60000)
  const abs = Math.abs(diffMin)
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (abs < 1) return rtf.format(0, 'minute')
  if (abs < 60) return rtf.format(diffMin, 'minute')
  if (abs < 60 * 24) return rtf.format(Math.round(diffMin / 60), 'hour')
  return rtf.format(Math.round(diffMin / 1440), 'day')
}

export const ALL_WEEKDAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS_MON_FRI: Weekday[] = [1, 2, 3, 4, 5]
export const WEEKEND: Weekday[] = [0, 6]

/** "Every day" / "Weekdays" / "Weekends" / "Mon, Wed, Fri" — short words, never a bitmask. */
export function describeDays(days: Weekday[], locale = 'en'): string {
  const set = new Set(days)
  if (set.size === 7) return 'Every day'
  if (set.size === 5 && WEEKDAYS_MON_FRI.every((d) => set.has(d))) return 'Weekdays'
  if (set.size === 2 && WEEKEND.every((d) => set.has(d))) return 'Weekends'
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const ref = new Date(2024, 0, 7) // a Sunday
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => fmt.format(addDays(ref, d)))
    .join(', ')
}
