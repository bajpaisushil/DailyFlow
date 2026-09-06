import type { Reminder } from '@/lib/types'
import { soundUri } from './customSound'
import { alarmId, alarmOccurrences, ownSoundOccurrences, wantsOwnSound } from './alarmOccurrences'

export {
  alarmId, alarmOccurrences, ownSoundOccurrences, wantsOwnSound, currentAlarmIds,
} from './alarmOccurrences'
import {
  alarmModuleAvailable, cancelScheduledAlarm, scheduleAlarm,
} from '../../../modules/dailyflow-alarm'
import { DEFAULT_ALARM_SECONDS } from './ringLength'

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
  /**
   * Every id genuinely handed to AlarmManager. Persisted by the caller and passed back as
   * `previousIds` next time, so cancellation is driven by what WAS scheduled rather than by
   * what the current reminders imply — the two diverge the moment a reminder is deleted,
   * disabled, retimed, or changed from an alarm to a notification.
   */
  scheduledIds: string[]
}

/**
 * Hand every alarm to the OS, replacing whatever was there before.
 *
 * Cancel-then-schedule, like the notification path: there is no way to diff what AlarmManager
 * holds, and the set is small and bounded.
 */
export function syncAlarms(reminders: Reminder[], previousIds: string[] = []): AlarmSyncResult {
  if (!alarmModuleAvailable()) {
    return {
      scheduled: 0, exact: false, available: false,
      ownSoundReminderIds: [], scheduledIds: [],
    }
  }

  for (const id of previousIds) cancelScheduledAlarm(id)

  const now = new Date()
  let scheduled = 0
  let exact = true
  const ownSoundReminderIds: string[] = []
  const scheduledIds: string[] = []
  // Reminders the native path has taken over, by either route.
  const claimed = new Set<string>()

  for (const reminder of reminders) {
    for (const at of alarmOccurrences(reminder, now)) {
      const id = alarmId(reminder.id, at)
      const outcome = scheduleAlarm({
        id,
        at,
        title: reminder.title,
        body: reminder.message,
        soundUri: soundUri(reminder.soundFile) ?? undefined,
        durationSeconds: reminder.alarmDurationSeconds ?? DEFAULT_ALARM_SECONDS,
        vibrate: reminder.vibrate,
        style: 'alarm',
      })
      if (outcome === 'inexact') exact = false
      if (outcome !== 'failed') {
        scheduled += 1
        scheduledIds.push(id)
        /**
         * Claim it, so the notification scheduler skips it.
         *
         * An alarm-style reminder was being scheduled TWICE for the same instant: once through
         * AlarmManager, which rings and takes the screen, and once as an ordinary OS
         * notification on the loud alarm channel. Two sounds, two entries in the shade, for one
         * reminder. Claimed only after a firing really was scheduled, so a failed native
         * schedule still falls back to the notification rather than going silent.
         */
        /**
         * Only 'alarm', never 'both'.
         *
         * With 'both', ONLY the firing at the real moment rings; the early warnings are meant
         * to stay ordinary notifications. Claiming the whole reminder would delete those
         * warnings entirely — the user would lose the "in 30 minutes" nudge they asked for and
         * be left with just the alarm.
         */
        if (reminder.alertStyle === 'alarm') claimed.add(reminder.id)
      }
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
      const id = alarmId(reminder.id, at)
      const outcome = scheduleAlarm({
        id,
        at,
        title: reminder.title,
        body: reminder.message,
        soundUri: uri,
        // A backstop only: playback ends when the file does.
        durationSeconds: MAX_OWN_SOUND_SECONDS,
        vibrate: reminder.vibrate,
        style: 'sound',
      })
      if (outcome === 'inexact') exact = false
      if (outcome === 'failed') continue
      anyScheduled = true
      scheduled += 1
      scheduledIds.push(id)
    }
    if (anyScheduled) claimed.add(reminder.id)
  }

  ownSoundReminderIds.push(...claimed)

  return { scheduled, exact, available: true, ownSoundReminderIds, scheduledIds }
}

/**
 * The backstop, not the intended length.
 *
 * Playback normally ends when the FILE ends — the player stops itself on completion. This only
 * catches a file that turns out to be enormous, and it matches the native service's own hard
 * cap so the two cannot disagree. It was five minutes, which silently truncated anything
 * longer even though files of up to 50 MB can now be chosen.
 */
const MAX_OWN_SOUND_SECONDS = 15 * 60
