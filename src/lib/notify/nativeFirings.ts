import type { Reminder } from '@/lib/types'
import { alarmId, alarmOccurrences, ownSoundOccurrences } from './alarmOccurrences'

/**
 * The firings AlarmManager is holding, derived rather than read.
 *
 * "What is set" exists so a user can check the phone really has their reminders, instead of
 * taking the app's word for it. It read the OS notification list — which is now the wrong
 * question for two kinds of reminder: an alarm, and a reminder playing its own sound, both go
 * to AlarmManager instead. Neither would have appeared, so the screen built to prove reminders
 * are set would have said "nothing is waiting" while they were perfectly set.
 *
 * AlarmManager cannot be enumerated — there is no API to ask it what it holds — so these are
 * recomputed from exactly the same functions that scheduled them. That is honest as long as
 * the two stay in step, which is why both call the same occurrence functions rather than
 * repeating the arithmetic.
 */

export interface NativeFiring {
  id: string
  title: string
  at: number
  kind: 'alarm' | 'sound'
}

export function nativeFirings(reminders: Reminder[], now = new Date()): NativeFiring[] {
  const out: NativeFiring[] = []

  for (const reminder of reminders) {
    for (const at of alarmOccurrences(reminder, now)) {
      out.push({ id: alarmId(reminder.id, at), title: reminder.title, at, kind: 'alarm' })
    }
    for (const at of ownSoundOccurrences(reminder, now)) {
      out.push({ id: alarmId(reminder.id, at), title: reminder.title, at, kind: 'sound' })
    }
  }

  return out.sort((a, b) => a.at - b.at)
}

/** The next few, which is all a person actually reads on that screen. */
export function nextNativeFirings(
  reminders: Reminder[],
  limit = 10,
  now = new Date(),
): NativeFiring[] {
  return nativeFirings(reminders, now).slice(0, limit)
}
