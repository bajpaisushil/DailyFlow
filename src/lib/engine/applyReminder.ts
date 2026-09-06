import type { Reminder } from '@/lib/types'
import * as repo from '@/lib/db/repo'
import { compileReminder, staleReminderAutomationIds } from './compileReminder'
import { resyncAll } from './apply'
import { syncGeofences } from '@/lib/location/geofence'

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

  const [schedule, geofence] = await Promise.all([resyncAll(), syncGeofences()])
  return { ...schedule, geofencesWatched: geofence.watched }
}

/** Removes a reminder and everything it generated. */
export async function removeReminder(reminderId: string): Promise<void> {
  for (const a of repo.automations.all()) {
    if (a.sourceReminderId === reminderId) repo.automations.purge(a.id)
  }
  repo.reminders.remove(reminderId)
  await Promise.all([resyncAll(), syncGeofences()])
}
