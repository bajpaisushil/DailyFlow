import type { LocalDate, Reminder, Weekday } from '@/lib/types'
import { addDays, localDateKey, parseHHMM, startOfLocalDay } from '@/lib/time'

/**
 * Reminders that run for a fixed period — "three times a day for one week".
 *
 * A course expires by construction: every occurrence is scheduled as its own dated
 * notification, so when the week is up there is simply nothing left. The alternative — a
 * repeating rule plus a note to switch it off later — fails the moment the app is not opened,
 * and a reminder that outlives its reason is exactly how people learn to ignore reminders.
 */

export interface Occurrence {
  /** Absolute local time this should fire. */
  at: number
  date: LocalDate
  time: string
}

export function isCourse(reminder: Pick<Reminder, 'endsOn'>): boolean {
  return !!reminder.endsOn
}

type CourseShape = Pick<Reminder, 'times' | 'days' | 'startsOn' | 'endsOn' | 'leadMinutes'> & {
  /**
   * Fire on exactly these dates rather than on every day in the range.
   *
   * Monthly and yearly reminders cannot be a range walk — the gap between occurrences is far
   * longer than any horizon worth walking day by day, and the weekday filter would be wrong
   * for them anyway.
   */
  dates?: LocalDate[]
}

/**
 * Every firing a bounded reminder implies, in order.
 * `from` is injected so this is deterministic and testable.
 */
export function courseOccurrences(reminder: CourseShape, from: Date, maxDays = 120): Occurrence[] {
  if (reminder.dates?.length) return datedOccurrences(reminder, from)
  if (!reminder.endsOn) return []

  const start = reminder.startsOn ? new Date(`${reminder.startsOn}T00:00:00`) : startOfLocalDay(from)
  const end = new Date(`${reminder.endsOn}T23:59:59`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return []

  const leads = [...new Set(reminder.leadMinutes.length ? reminder.leadMinutes : [0])]
  const out: Occurrence[] = []

  let cursor = startOfLocalDay(start)
  let guard = 0

  while (cursor.getTime() <= end.getTime() && guard < maxDays) {
    const weekday = cursor.getDay() as Weekday
    const runsToday = reminder.days.length === 0 || reminder.days.includes(weekday)

    if (runsToday) {
      for (const time of reminder.times) {
        const minutes = parseHHMM(time)
        if (minutes == null) continue
        for (const lead of leads) {
          const at = new Date(cursor)
          at.setHours(0, minutes - lead, 0, 0)
          // Skip the past: scheduling a past date fires immediately.
          if (at.getTime() <= from.getTime()) continue
          if (at.getTime() > end.getTime()) continue
          out.push({ at: at.getTime(), date: localDateKey(at), time })
        }
      }
    }

    cursor = addDays(cursor, 1)
    guard += 1
  }

  return out.sort((a, b) => a.at - b.at)
}

/**
 * Firings on an explicit set of dates.
 *
 * Weekdays are deliberately NOT applied: the date is the instruction. A yearly reminder for a
 * festival that happens to fall on a Sunday, against a reminder still carrying Mon-Fri from an
 * earlier edit, would otherwise fire never.
 */
function datedOccurrences(reminder: CourseShape, from: Date): Occurrence[] {
  const leads = [...new Set(reminder.leadMinutes.length ? reminder.leadMinutes : [0])]
  const out: Occurrence[] = []

  for (const date of reminder.dates ?? []) {
    const day = new Date(`${date}T00:00:00`)
    if (Number.isNaN(day.getTime())) continue

    for (const time of reminder.times) {
      const minutes = parseHHMM(time)
      if (minutes == null) continue
      for (const lead of leads) {
        const at = new Date(day)
        at.setHours(0, minutes - lead, 0, 0)
        // Skip the past: scheduling a past moment fires immediately.
        if (at.getTime() <= from.getTime()) continue
        out.push({ at: at.getTime(), date: localDateKey(at), time })
      }
    }
  }

  return out.sort((a, b) => a.at - b.at)
}

/** How many notifications a course occupies, so the editor can warn before any are lost. */
export function occurrenceCount(reminder: CourseShape, from: Date): number {
  return courseOccurrences(reminder, from).length
}

/** "3 times a day until 13 September" — the course, said back as a sentence. */
export function describeCourse(
  reminder: Pick<Reminder, 'times' | 'endsOn'>,
  locale = 'en',
): string | null {
  if (!reminder.endsOn) return null
  const perDay = reminder.times.length
  const howOften = perDay === 1 ? 'Once a day' : `${perDay} times a day`

  const end = new Date(`${reminder.endsOn}T00:00:00`)
  let until = reminder.endsOn
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      until = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' }).format(end)
    }
  } catch {
    // Keep the ISO date; a thin Intl must not break the sentence.
  }
  return `${howOften} until ${until}`
}

/** Convenience for the editor's "for how long" chips. */
export function endDateAfterDays(from: Date, days: number): LocalDate {
  return localDateKey(addDays(startOfLocalDay(from), days - 1))
}
