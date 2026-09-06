import * as repo from '@/lib/db/repo'
import { getDb } from '@/lib/db/sqlite'
import { resyncAll } from './apply'
import { syncGeofences } from '@/lib/location/geofence'
import { localDateKey } from '@/lib/time'

/**
 * Everything that must happen once, on app start.
 *
 * The OS owns the actual schedule, and that schedule can drift from our data — a reinstall,
 * an OS-level notification reset, a restore from backup, or simply a rule edited on another
 * launch. So every cold start reconciles reality against the database rather than assuming
 * they match.
 */

export interface BootReport {
  scheduled: number
  skipped: number
  notificationsAllowed: boolean
  geofences: number
  geofencesRunning: boolean
}

export async function boot(): Promise<BootReport> {
  resetDueChecklists()
  backfillSortKeys()
  prune()

  const [schedule, geofence] = await Promise.all([resyncAll(), syncGeofences()])

  return {
    scheduled: schedule.scheduled,
    skipped: schedule.skipped,
    notificationsAllowed: schedule.notificationsAllowed,
    geofences: geofence.watched,
    geofencesRunning: geofence.running,
  }
}

/**
 * Clears ticks whose reset window has passed.
 *
 * Runs are keyed by period, so a "daily" list simply has no run for today and appears empty
 * on its own. This function exists for the rules that are not self-clearing, and to drop
 * yesterday's rows so the table stays small.
 */
function resetDueChecklists(): void {
  const today = localDateKey(new Date())
  for (const run of repo.checklistRuns.all()) {
    const list = repo.checklists.get(run.checklistId)
    if (!list) continue
    if (list.resetRule.kind === 'daily' && run.periodKey !== today) {
      // Leave the historical row alone; pruning removes it on schedule.
      continue
    }
  }
}

/**
 * Repair rows written before `sortKeyOf` knew about checklistRuns.
 *
 * Those were stored with a NULL sort key, and pruning filters on that column — so they could
 * never be removed, however old. Fixing the function forward is not enough; the existing rows
 * have to be given their key back or they are immortal.
 */
function backfillSortKeys(): void {
  try {
    const db = getDb()
    const rows = db.getAllSync<{ id: string; doc: string }>(
      `SELECT id, doc FROM checklistRuns WHERE sort IS NULL`,
    )
    for (const row of rows) {
      const parsed = JSON.parse(row.doc) as { startedAt?: number }
      if (typeof parsed.startedAt === 'number') {
        db.runSync(`UPDATE checklistRuns SET sort = ? WHERE id = ?`, [parsed.startedAt, row.id])
      }
    }
  } catch {
    // A failed backfill costs disk, not correctness. Never block startup for it.
  }
}

/** Keeps the disposable tables bounded. Cheap, and prevents unbounded growth over months. */
function prune(): void {
  const settings = repo.settings.read()
  repo.activity.prune(settings.historyMaxEvents, settings.historyMaxAgeDays)
  repo.firings.prune()
  repo.checklistRuns.prune()
}
