import type { Reminder } from '@/lib/types'
import { soundUri } from './customSound'
import { alarmId, alarmOccurrences, ownSoundOccurrences, wantsOwnSound } from './alarmOccurrences'

export {
  alarmId, alarmOccurrences, ownSoundOccurrences, wantsOwnSound,
} from './alarmOccurrences'
import {
  alarmModuleAvailable, cancelScheduledAlarm, scheduleAlarm,
} from '../../../modules/dailyflow-alarm'
import { DEFAULT_ALARM_SECONDS } from './alarm'

/**
 * Scheduling the real alarms.
 *
 * A timed alarm cannot go through the notification scheduler: expo-notifications shows a
 * banner, and taking over the screen needs a full-screen intent it cannot express. Worse, our
 * JavaScript is not running when the moment arrives, so nothing in JS can ring anything.
 * These go to Android's AlarmManager, which wakes a native receiver directly.
 *
 * Only reminders whose style includes 'alarm' come here. Everything else stays with the
 * ordinary notification path, which is right: most reminders should not seize the screen.
 */

export interface AlarmSyncResult {
  scheduled: number
  exact: boolean
  available: boolean
  /**
   * Reminders whose sound this path has taken over, so the notification scheduler leaves them
   * alone. Without it the user would get the same reminder twice — once from us with the
   * right sound, once from the OS with the wrong one.
   */
  ownSoundReminderIds: string[]
}

/**
 * Hand every alarm to the OS, replacing whatever was there before.
 *
 * Cancel-then-schedule, like the notification path: there is no way to diff what AlarmManager
 * holds, and the set is small and bounded.
 */
export function syncAlarms(reminders: Reminder[], previousIds: string[] = []): AlarmSyncResult {
  if (!alarmModuleAvailable()) {
    return { scheduled: 0, exact: false, available: false, ownSoundReminderIds: [] }
  }

  for (const id of previousIds) cancelScheduledAlarm(id)

  const now = new Date()
  let scheduled = 0
  let exact = true
  const ownSoundReminderIds: string[] = []

  for (const reminder of reminders) {
    for (const at of alarmOccurrences(reminder, now)) {
      const outcome = scheduleAlarm({
        id: alarmId(reminder.id, at),
        at,
        title: reminder.title,
        body: reminder.message,
        soundUri: soundUri(reminder.soundFile) ?? undefined,
        durationSeconds: reminder.alarmDurationSeconds ?? DEFAULT_ALARM_SECONDS,
        vibrate: reminder.vibrate,
        style: 'alarm',
      })
      if (outcome === 'inexact') exact = false
      if (outcome !== 'failed') scheduled += 1
    }

    /**
     * A notification-only reminder with a chosen sound takes the same route, in 'sound' mode:
     * no screen takeover, no looping — the file plays through once and the reminder is left in
     * the notification shade.
     *
     * The URI is resolved first and the reminder is only claimed if it exists. A missing file
     * would otherwise mean the notification scheduler skipped it AND this played nothing, and
     * the reminder would vanish entirely.
     */
    const uri = wantsOwnSound(reminder) ? soundUri(reminder.soundFile) : null
    if (!uri) continue

    const moments = ownSoundOccurrences(reminder, now)
    if (moments.length === 0) continue

    /**
     * Claimed only once a firing has ACTUALLY been scheduled. The notification scheduler skips
     * whatever appears here, so claiming a reminder whose native schedule failed would leave it
     * with no sound and no notification — gone entirely, which is far worse than the wrong
     * sound this whole path exists to fix.
     */
    let anyScheduled = false
    for (const at of moments) {
      const outcome = scheduleAlarm({
        id: alarmId(reminder.id, at),
        at,
        title: reminder.title,
        body: reminder.message,
        soundUri: uri,
        // A backstop only: playback ends when the file does. This caps a file that turns out
        // to be an hour long.
        durationSeconds: MAX_OWN_SOUND_SECONDS,
        vibrate: reminder.vibrate,
        style: 'sound',
      })
      if (outcome === 'inexact') exact = false
      if (outcome === 'failed') continue
      anyScheduled = true
      scheduled += 1
    }
    if (anyScheduled) ownSoundReminderIds.push(reminder.id)
  }

  return { scheduled, exact, available: true, ownSoundReminderIds }
}

/** However long the chosen file is, it stops here. Five minutes is already generous. */
const MAX_OWN_SOUND_SECONDS = 5 * 60

/** The ids currently scheduled, so the next sync can cancel them. */
export function currentAlarmIds(reminders: Reminder[], from = new Date()): string[] {
  return reminders.flatMap((r) => [
    ...alarmOccurrences(r, from).map((at) => alarmId(r.id, at)),
    ...ownSoundOccurrences(r, from).map((at) => alarmId(r.id, at)),
  ])
}
