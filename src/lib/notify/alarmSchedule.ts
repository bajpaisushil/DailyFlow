import type { Reminder } from '@/lib/types'
import { soundUri } from './customSound'
import { alarmId, alarmOccurrences } from './alarmOccurrences'

export { alarmId, alarmOccurrences } from './alarmOccurrences'
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
}

/**
 * Hand every alarm to the OS, replacing whatever was there before.
 *
 * Cancel-then-schedule, like the notification path: there is no way to diff what AlarmManager
 * holds, and the set is small and bounded.
 */
export function syncAlarms(reminders: Reminder[], previousIds: string[] = []): AlarmSyncResult {
  if (!alarmModuleAvailable()) return { scheduled: 0, exact: false, available: false }

  for (const id of previousIds) cancelScheduledAlarm(id)

  const now = new Date()
  let scheduled = 0
  let exact = true

  for (const reminder of reminders) {
    for (const at of alarmOccurrences(reminder, now)) {
      const wasExact = scheduleAlarm({
        id: alarmId(reminder.id, at),
        at,
        title: reminder.title,
        body: reminder.message,
        soundUri: soundUri(reminder.soundFile) ?? undefined,
        durationSeconds: reminder.alarmDurationSeconds ?? DEFAULT_ALARM_SECONDS,
        vibrate: reminder.vibrate,
      })
      if (!wasExact) exact = false
      scheduled += 1
    }
  }

  return { scheduled, exact, available: true }
}

/** The ids currently scheduled, so the next sync can cancel them. */
export function currentAlarmIds(reminders: Reminder[], from = new Date()): string[] {
  return reminders.flatMap((r) => alarmOccurrences(r, from).map((at) => alarmId(r.id, at)))
}
