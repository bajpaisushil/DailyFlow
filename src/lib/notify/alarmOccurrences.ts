import type { Reminder } from '@/lib/types'
import { courseOccurrences } from '@/lib/course'
import { parseHHMM, startOfLocalDay } from '@/lib/time'

/**
 * Which moments a reminder should actually RING at — pure, so the arithmetic is testable
 * without a native runtime. `alarmSchedule.ts` hands these to Android's AlarmManager.
 *
 * This exists because a timed alarm cannot go through the notification path: taking over the
 * screen needs a full-screen intent expo-notifications cannot express, and our JavaScript is
 * not running when the moment arrives, so nothing in JS could ring anything.
 */

/** How far ahead to lay out occurrences. Refreshed on every app start and every edit. */
export const HORIZON_DAYS = 14

/** A cap, so a badly configured course cannot fill the OS alarm table. */
export const MAX_ALARMS = 40

export function alarmId(reminderId: string, at: number): string {
  return `${reminderId}:${at}`
}

export function alarmOccurrences(
  reminder: Reminder,
  from: Date,
  horizonDays = HORIZON_DAYS,
): number[] {
  // Ordinary reminders stay on the notification path. Seizing the screen for those is the
  // behaviour people switch the whole feature off over.
  if (reminder.alertStyle !== 'alarm' && reminder.alertStyle !== 'both') return []
  return timedOccurrences(reminder, from, horizonDays)
}

/**
 * Whether this reminder's sound has to be played by us rather than by the OS.
 *
 * A notification's sound belongs to its Android channel, and a channel can only sound a file
 * COMPILED INTO THE APP — never one the user picked, which lives in storage the system's
 * notification service is not allowed to read. Android therefore substitutes the phone's
 * default, and the file the user chose is simply never heard.
 *
 * So for a notification-only reminder with a chosen sound we take the same route the alarms
 * take: AlarmManager wakes a native receiver, which plays the file itself and posts the
 * reminder. Reminders that already ring as alarms are excluded — they play the file anyway.
 */
export function wantsOwnSound(reminder: Reminder): boolean {
  return (
    reminder.sound === true &&
    !!reminder.soundFile &&
    reminder.alertStyle === 'notification'
  )
}

/**
 * The moments a notification-only reminder must play its own sound at.
 *
 * Every firing, including the early warnings — unlike an alarm, this is not disruptive, so
 * there is no reason to make the lead times sound different from the reminder itself.
 */
export function ownSoundOccurrences(
  reminder: Reminder,
  from: Date,
  horizonDays = HORIZON_DAYS,
): number[] {
  if (!wantsOwnSound(reminder)) return []
  return timedOccurrences(reminder, from, horizonDays)
}

/** The clock arithmetic both paths share. */
function timedOccurrences(
  reminder: Reminder,
  from: Date,
  horizonDays: number,
): number[] {
  if (!reminder.enabled) return []
  if (reminder.times.length === 0) return []

  // A bounded course already knows its own dates; reuse that rather than duplicate the logic.
  if (reminder.endsOn) {
    return courseOccurrences(reminder, from).map((o) => o.at).slice(0, MAX_ALARMS)
  }

  const out: number[] = []
  const leads = [...new Set(reminder.leadMinutes.length ? reminder.leadMinutes : [0])]

  for (let day = 0; day < horizonDays; day += 1) {
    const date = startOfLocalDay(from)
    date.setDate(date.getDate() + day)
    const weekday = date.getDay()
    if (reminder.days.length > 0 && !reminder.days.includes(weekday as never)) continue

    for (const time of reminder.times) {
      const minutes = parseHHMM(time)
      if (minutes == null) continue

      /**
       * With 'both', only the firing at the real moment rings; the early warnings stay
       * ordinary notifications. A nudge half an hour ahead that seizes the screen is one
       * people switch off entirely.
       */
      const ringingLeads = reminder.alertStyle === 'both' ? [0] : leads

      for (const lead of ringingLeads) {
        const at = new Date(date)
        at.setHours(0, minutes - lead, 0, 0)
        if (at.getTime() <= from.getTime()) continue
        out.push(at.getTime())
      }
    }
  }

  return out.sort((a, b) => a - b).slice(0, MAX_ALARMS)
}

/**
 * The ids the CURRENT reminders imply.
 *
 * Kept for tests and diagnostics only. It must NOT be used to decide what to cancel: it can
 * only ever name alarms the present configuration would create, so anything scheduled before
 * a delete, a disable, a retime or a switch to plain notifications is invisible to it and
 * would stay armed. `repo.scheduledAlarms` is the record that drives cancellation.
 */
export function currentAlarmIds(reminders: Reminder[], from = new Date()): string[] {
  return reminders.flatMap((r) => [
    ...alarmOccurrences(r, from).map((at) => alarmId(r.id, at)),
    ...ownSoundOccurrences(r, from).map((at) => alarmId(r.id, at)),
  ])
}
