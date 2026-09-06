import type { Reminder } from '@/lib/types'
import * as repo from '@/lib/db/repo'
import { compileReminder, staleReminderAutomationIds } from './compileReminder'
import { resyncAll } from './apply'
import { syncGeofences } from '@/lib/location/geofence'
import { syncAlarms } from '@/lib/notify/alarmSchedule'
import { cancelScheduledAlarm, cancelSnoozedAlarm } from '../../../modules/dailyflow-alarm'

/**
 * Saving a reminder, and turning it into something the phone will actually do.
 *
 * Order matters: persist, recompile (preserving automation ids so the firing ledger stays
 * valid), drop what the reminder no longer implies, then hand the clock-based rules to the OS
 * scheduler and refresh the watched geofences. A reminder that mentions a place changes what
 * needs monitoring, so both have to be re-synced, not just the schedule.
 */
export interface ReminderResult {
  scheduled: number
  skipped: number
  notificationsAllowed: boolean
  geofencesWatched: number
  /** Full-screen alarms handed to AlarmManager. */
  alarmsScheduled: number
  /** False when Android will not grant exact alarms, so they may drift by minutes. */
  alarmsExact: boolean
}

export async function applyReminder(reminder: Reminder): Promise<ReminderResult> {
  repo.reminders.save(reminder)

  const checklists = repo.checklists.all()
  const existing = repo.automations.all().filter((a) => a.sourceReminderId === reminder.id)

  const compiled = compileReminder(reminder, checklists, existing)
  repo.automations.saveMany(compiled)

  for (const id of staleReminderAutomationIds(compiled, existing)) {
    repo.automations.purge(id)
  }

  /**
   * Alarms FIRST, then notifications.
   *
   * The alarm pass is what discovers which reminders play their own sound natively, and the
   * notification pass has to skip exactly those. Running them in parallel would mean the
   * notification schedule was built before anyone knew, and every such reminder would arrive
   * twice — once with the sound the user chose, once with the phone's default.
   */
  const alarms = resyncAlarms()
  const [schedule, geofence] = await Promise.all([
    resyncAll(alarms.ownSoundReminderIds),
    syncGeofences(),
  ])

  return {
    ...schedule,
    geofencesWatched: geofence.watched,
    alarmsScheduled: alarms.scheduled,
    alarmsExact: alarms.exact,
  }
}

/**
 * Re-hand every full-screen alarm to AlarmManager.
 *
 * Separate from the notification schedule on purpose: a timed alarm cannot go through
 * expo-notifications at all. Taking over the screen needs a full-screen intent it does not
 * expose, and our JavaScript is not running when the moment arrives — so an "alarm" scheduled
 * that way could only ever have been a louder banner.
 */
export function resyncAlarms(): {
  scheduled: number
  exact: boolean
  ownSoundReminderIds: string[]
} {
  const reminders = repo.reminders.all()

  /**
   * Cancel what was ACTUALLY scheduled, read back from storage.
   *
   * This used to re-derive the ids from the current reminders, which can only name alarms the
   * current configuration implies. Delete a reminder, switch it off, move its time, or change
   * it from an alarm to a notification, and its armed alarms became unnameable — so they were
   * never cancelled and went on ringing every day for the fortnight they were laid out for,
   * with no screen in the app able to reach them.
   */
  const previous = repo.scheduledAlarms.read()
  const result = syncAlarms(reminders, previous)
  repo.scheduledAlarms.write(result.scheduledIds)

  return {
    scheduled: result.scheduled,
    exact: result.exact,
    ownSoundReminderIds: result.ownSoundReminderIds,
  }
}

/**
 * Disarm every alarm the phone is holding for us.
 *
 * Needed before wiping the app: the ledger of scheduled ids lives in the database, so clearing
 * the database first destroys the only record of what to cancel. AlarmManager cannot be
 * enumerated, so those alarms would then be permanently unreachable — ringing for as long as
 * they were laid out for, up to four years for a yearly reminder, with the reminder itself
 * gone and no screen in the app able to name them.
 */
export function cancelAllAlarms(): void {
  for (const id of repo.scheduledAlarms.read()) cancelScheduledAlarm(id)
  repo.scheduledAlarms.write([])
  // A snooze is armed under a fixed code the ledger never sees, so it needs saying separately
  // — otherwise erasing everything still leaves one alarm due to ring in five minutes.
  cancelSnoozedAlarm()
}

/** Removes a reminder and everything it generated. */
export async function removeReminder(reminderId: string): Promise<void> {
  for (const a of repo.automations.all()) {
    if (a.sourceReminderId === reminderId) repo.automations.purge(a.id)
  }
  repo.reminders.remove(reminderId)
  const alarms = resyncAlarms()
  await Promise.all([resyncAll(alarms.ownSoundReminderIds), syncGeofences()])
}
