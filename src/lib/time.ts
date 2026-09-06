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

/**
 * Hermes ships only part of Intl, and which part varies by platform and build. Anything
 * touching Intl therefore has to survive it being absent — `Intl.RelativeTimeFormat` is
 * undefined on Android Hermes and crashed two screens before this was caught.
 */
function safeFormat(d: Date, locale: string, opts: Intl.DateTimeFormatOptions): string | null {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') return null
    return new Intl.DateTimeFormat(locale, opts).format(d)
  } catch {
    return null
  }
}

/** "6:45 AM" or "06:45" depending on the user's clock preference. */
export function formatTime(time: HHMM, use24h: boolean, locale = 'en'): string {
  const mins = parseHHMM(time)
  if (mins == null) return time
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const d = new Date()
  d.setHours(h, m, 0, 0)

  const formatted = safeFormat(d, locale, {
    hour: use24h ? '2-digit' : 'numeric',
    minute: '2-digit',
    hour12: !use24h,
  })
  if (formatted) return formatted

  // Hand-rolled fallback, so a device with a thin Intl still shows a readable time.
  const mm = String(m).padStart(2, '0')
  if (use24h) return `${String(h).padStart(2, '0')}:${mm}`
  const suffix = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${mm} ${suffix}`
}

/**
 * Plain-word relative time — "just now", "10 minutes ago", "in 2 hours".
 *
 * Hand-rolled rather than using `Intl.RelativeTimeFormat`, which is undefined on Android
 * Hermes and crashed the Commute and History screens. Writing it out also means the wording
 * is ours: short, concrete, and consistent with the rest of the app's vocabulary, rather than
 * whatever phrasing the platform happens to produce.
 */
export function humanDelta(fromMs: number, toMs: number, _locale = 'en'): string {
  const diffMin = Math.round((toMs - fromMs) / 60000)
  const abs = Math.abs(diffMin)
  const past = diffMin < 0

  if (abs < 1) return 'just now'

  const say = (n: number, unit: string) => {
    const plural = n === 1 ? unit : `${unit}s`
    return past ? `${n} ${plural} ago` : `in ${n} ${plural}`
  }

  if (abs < 60) return say(abs, 'minute')
  if (abs < 60 * 24) return say(Math.round(abs / 60), 'hour')
  return say(Math.round(abs / 1440), 'day')
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
  const ref = new Date(2024, 0, 7) // a Sunday
  const FALLBACK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => safeFormat(addDays(ref, d), locale, { weekday: 'short' }) ?? FALLBACK[d] ?? '')
    .join(', ')
}

/**
 * A weekday's name, safe against a thin Intl. `narrow` is the single letter used by the day
 * strip; `long` is what a screen reader announces.
 */
export function weekdayName(
  day: Weekday,
  width: 'narrow' | 'short' | 'long',
  locale = 'en',
): string {
  const ref = new Date(2024, 0, 7 + day) // 2024-01-07 was a Sunday
  const formatted = safeFormat(ref, locale, { weekday: width })
  if (formatted) return formatted

  const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const name = LONG[day] ?? ''
  if (width === 'long') return name
  if (width === 'short') return name.slice(0, 3)
  return name.slice(0, 1)
}

/** The date line on Today, e.g. "Saturday, 6 September". Falls back to a plain date. */
export function formatLongDate(d: Date, locale = 'en'): string {
  return (
    safeFormat(d, locale, { weekday: 'long', day: 'numeric', month: 'long' }) ??
    `${weekdayName(weekdayOf(d), 'long', locale)}, ${d.getDate()}/${d.getMonth() + 1}`
  )
}
