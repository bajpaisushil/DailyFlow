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
  if (!reminder.enabled) return []
  // Ordinary reminders stay on the notification path. Seizing the screen for those is the
  // behaviour people switch the whole feature off over.
  if (reminder.alertStyle !== 'alarm' && reminder.alertStyle !== 'both') return []
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
