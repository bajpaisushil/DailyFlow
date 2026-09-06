import type { LocalDate, RepeatKind } from '@/lib/types'
import { localDateKey, startOfLocalDay } from '@/lib/time'

/**
 * How often a reminder comes back.
 *
 * The app used to ask "for how long?", which quietly conflated two different questions: how
 * often does this happen, and when should it stop? Those have different answers for different
 * KINDS of thing. A habit repeats every week. An interview happens once and never again.
 * Diwali comes back every year. Asking "how often" first, in those words, is the difference
 * between a user modelling their life correctly and fighting a duration slider.
 */
export type { RepeatKind }

/** Days in a given month. Month is 0-based, as in Date. */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function parse(anchor: LocalDate): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anchor)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  return { year, month, day }
}

/**
 * The next `count` dates this reminder falls on, starting from `from` inclusive.
 *
 * Two clamping rules, both of which are silent data loss if you get them wrong:
 *
 *  - MONTH END. "The 31st, monthly" has no 31st in February. The occurrence moves to the last
 *    day of that month rather than vanishing or spilling into March — a rent reminder set for
 *    the 31st must still arrive in a 30-day month.
 *  - LEAP DAY. "29 February, yearly" exists once every four years. It falls back to 28
 *    February in common years, so a birthday reminder is not silent for three years at a time.
 */
export function nextDates(
  kind: RepeatKind,
  anchor: LocalDate,
  from: Date,
  count = 4,
): LocalDate[] {
  const parts = parse(anchor)
  if (!parts) return []

  const today = startOfLocalDay(from)
  const out: LocalDate[] = []

  if (kind === 'once') {
    const at = new Date(parts.year, parts.month, parts.day)
    return at.getTime() >= today.getTime() ? [localDateKey(at)] : []
  }

  if (kind === 'yearly') {
    // Start at this year, not the anchor's year: an anniversary set in 2020 is still due
    // this year, and walking forward from 2020 would spend every slot on dates long gone.
    let year = Math.max(parts.year, today.getFullYear())
    while (out.length < count) {
      const day = Math.min(parts.day, daysInMonth(year, parts.month))
      const at = new Date(year, parts.month, day)
      if (at.getTime() >= today.getTime()) out.push(localDateKey(at))
      year += 1
    }
    return out
  }

  if (kind === 'monthly') {
    let year = today.getFullYear()
    let month = today.getMonth()
    // Step back one month so an occurrence still ahead in the CURRENT month is not skipped.
    month -= 1
    if (month < 0) {
      month = 11
      year -= 1
    }
    let guard = 0
    while (out.length < count && guard < count + 24) {
      guard += 1
      month += 1
      if (month > 11) {
        month = 0
        year += 1
      }
      const day = Math.min(parts.day, daysInMonth(year, month))
      const at = new Date(year, month, day)
      if (at.getTime() >= today.getTime()) out.push(localDateKey(at))
    }
    return out
  }

  // 'weekly' is the days-of-week model and does not produce explicit dates.
  return []
}

/** Whether this kind is expressed as concrete dates rather than as weekdays. */
export function isDated(kind: RepeatKind | undefined): boolean {
  return kind === 'once' || kind === 'monthly' || kind === 'yearly'
}

/** How the choice reads back to the user, in the words the picker used. */
export function describeRepeat(kind: RepeatKind | undefined): string {
  switch (kind) {
    case 'once':
      return 'Once, then never again'
    case 'monthly':
      return 'Every month'
    case 'yearly':
      return 'Every year'
    default:
      return 'Every week'
  }
}
