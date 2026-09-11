import type { LocalDate, Reminder, Weekday } from '@/lib/types'
import { localDateKey, startOfLocalDay } from '@/lib/time'

/**
 * Pausing a reminder without destroying it.
 *
 * People need a reminder to go quiet without losing it: away for the weekend, the medicine
 * finished early, not today. The only tools were Remove — which throws away the icon, the
 * times, the place, the sound and the list — and nothing else at all, since `enabled` existed
 * in the data model but had no switch anywhere in the app. So the actual choice was "delete it
 * and build it again later", which is how people end up with no reminders.
 *
 * One field does both: `pausedUntil` is the last date it stays quiet, inclusive. "Skip today"
 * sets it to today; "pause for a week" sets it a week out. Indefinitely off is the separate
 * `enabled` flag, because that one is not waiting for a date to pass.
 */

/** Quiet through the whole of `pausedUntil`, back to normal the day after. */
export function isPaused(
  reminder: Pick<Reminder, 'pausedUntil'>,
  now: Date = new Date(),
): boolean {
  if (!reminder.pausedUntil) return false
  return localDateKey(now) <= reminder.pausedUntil
}

/** Whether this reminder should do anything at all right now. */
export function isActive(
  reminder: Pick<Reminder, 'enabled' | 'pausedUntil'>,
  now: Date = new Date(),
): boolean {
  return reminder.enabled && !isPaused(reminder, now)
}

/** The value "skip today" stores: quiet for the rest of today, normal tomorrow. */
export function skipTodayUntil(now: Date = new Date()): LocalDate {
  return localDateKey(now)
}

/** The value "pause for N days" stores. N=1 is the same as skipping today. */
export function pauseForDays(days: number, now: Date = new Date()): LocalDate {
  const end = startOfLocalDay(now)
  end.setDate(end.getDate() + Math.max(1, Math.round(days)) - 1)
  return localDateKey(end)
}

/**
 * A pause that has already lapsed is dead weight: it makes a reminder look paused in the
 * editor and invites the user to "resume" something that resumed days ago.
 */
export function clearedIfLapsed(
  pausedUntil: LocalDate | undefined,
  now: Date = new Date(),
): LocalDate | undefined {
  if (!pausedUntil) return undefined
  return localDateKey(now) <= pausedUntil ? pausedUntil : undefined
}

/** What the user is told, in the words they chose it with. */
export function describePause(
  reminder: Pick<Reminder, 'enabled' | 'pausedUntil'>,
  now: Date = new Date(),
  locale?: string,
): string | null {
  if (!reminder.enabled) return 'Off'
  if (!isPaused(reminder, now)) return null

  const today = localDateKey(now)
  if (reminder.pausedUntil === today) return 'Skipped today'

  const back = new Date(`${reminder.pausedUntil}T12:00:00`)
  back.setDate(back.getDate() + 1)
  try {
    return `Paused until ${back.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}`
  } catch {
    return 'Paused'
  }
}

/**
 * The dates a paused repeating reminder should resume on.
 *
 * A daily or weekly reminder is handed to the OS as a REPEATING rule, and there is no way to
 * cancel one day of it. Pausing therefore cannot simply leave the rule in place — the OS would
 * fire straight through the pause. Nor can it just switch the rule off, because switching it
 * back on needs the app to be opened, and a person who paused a reminder for a week is exactly
 * the person not opening the app that week.
 *
 * So a paused reminder is laid out as explicit dates for the days it should ring AFTER the
 * pause ends, which the OS holds without our help. Every app start extends the horizon.
 */
export function datesAfterPause(
  reminder: Pick<Reminder, 'pausedUntil' | 'days'>,
  now: Date = new Date(),
  horizonDays = 21,
): LocalDate[] {
  if (!reminder.pausedUntil) return []

  const out: LocalDate[] = []
  const cursor = startOfLocalDay(now)

  for (let i = 0; i < horizonDays; i += 1) {
    const key = localDateKey(cursor)
    // Inclusive: the pause covers the whole of pausedUntil.
    if (key > reminder.pausedUntil) {
      const weekday = cursor.getDay() as Weekday
      if (reminder.days.length === 0 || reminder.days.includes(weekday)) out.push(key)
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  return out
}
