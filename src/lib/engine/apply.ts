import type { Automation, Routine } from '@/lib/types'
import * as repo from '@/lib/db/repo'
import { compileRoutine, staleAutomationIds } from './compile'
import { syncSchedules, readPermission, notificationsAvailable } from '@/lib/notify/scheduler'

/**
 * The single place where saving a routine turns into real, scheduled reminders.
 *
 * Order matters:
 *   1. Persist the routine.
 *   2. Recompile its automations, preserving ids so firing history survives an edit.
 *   3. Drop automations the routine no longer implies.
 *   4. Hand every clock-based rule to the OS scheduler.
 *
 * Step 4 is what makes a reminder fire with the app closed. It is also the step that can
 * legitimately do nothing — if the user has not allowed reminders, we schedule nothing and
 * say so, rather than pretending (REQUIREMENTS.md #34).
 */
export interface ApplyResult {
  automations: Automation[]
  scheduled: number
  skipped: number
  notificationsAllowed: boolean
}

export async function applyRoutine(routine: Routine): Promise<ApplyResult> {
  repo.routines.save(routine)

  const checklists = repo.checklists.all()
  const existing = repo.automations.all().filter((a) => a.sourceRoutineId === routine.id)

  const compiled = compileRoutine(routine, checklists, existing)
  repo.automations.saveMany(compiled)

  for (const id of staleAutomationIds(compiled, existing)) {
    repo.automations.purge(id)
  }

  return { ...(await resyncAll()), automations: compiled }
}

/** Removes a routine and everything it generated. */
export async function removeRoutine(routineId: string): Promise<void> {
  for (const a of repo.automations.all()) {
    if (a.sourceRoutineId === routineId) repo.automations.purge(a.id)
  }
  repo.routines.remove(routineId)
  await resyncAll()
}

/**
 * Re-hand the whole enabled rule set to the OS. Called after any change that could alter
 * what should fire, and on app start so a reinstall or an OS-level clear is repaired.
 */
export async function resyncAll(): Promise<Omit<ApplyResult, 'automations'>> {
  // A build that cannot schedule at all (Expo Go) is a different state from one where the
  // user has simply not granted permission. The UI needs to tell them apart.
  if (!notificationsAvailable()) {
    return { scheduled: 0, skipped: 0, notificationsAllowed: false }
  }

  const permission = await readPermission()
  if (permission !== 'granted') {
    return { scheduled: 0, skipped: 0, notificationsAllowed: false }
  }

  const settings = repo.settings.read()
  const enabled = repo.automations.all().filter((a) => a.enabled)
  const { scheduled, skipped } = await syncSchedules(enabled, {
    vibrate: settings.notifications.vibrate,
  })

  return { scheduled, skipped, notificationsAllowed: true }
}
