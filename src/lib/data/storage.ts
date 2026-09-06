import * as FileSystem from 'expo-file-system'
import * as store from '@/lib/db/sqlite'
import { S } from '@/lib/strings'

/**
 * "Space used" (REQUIREMENTS.md #41).
 *
 * A privacy-first app that keeps everything on the device owes the user a plain answer to
 * "how much room is this taking?". We report our own data honestly — measured from the
 * database, not estimated — alongside the phone's free space for context.
 */

export interface StorageLine {
  key: store.Collection
  label: string
  rows: number
  bytes: number
}

export interface StorageReport {
  lines: StorageLine[]
  totalBytes: number
  freeBytes: number | null
  capacityBytes: number | null
}

/** Plain words for each table — the user never sees a collection name. */
const LABELS: Record<store.Collection, string> = {
  settings: 'Your choices',
  scheduledAlarms: 'Alarms set on the phone',
  places: S.nav.places,
  checklists: S.nav.lists,
  checklistRuns: 'Ticks',
  routines: 'Day plans',
  reminders: S.nav.reminders,
  automations: 'How they run',
  commuteProfiles: S.way.title,
  commuteSessions: 'Trips',
  activity: S.settings.whatHappened,
  firings: 'Reminder history',
}

export async function readStorageReport(): Promise<StorageReport> {
  const lines: StorageLine[] = store.ALL_COLLECTIONS.map((key) => ({
    key,
    label: LABELS[key],
    rows: store.rowCount(key),
    bytes: store.collectionBytes(key),
  }))

  const totalBytes = lines.reduce((sum, l) => sum + l.bytes, 0)

  const [freeBytes, capacityBytes] = await Promise.all([
    FileSystem.getFreeDiskStorageAsync().catch(() => null),
    FileSystem.getTotalDiskCapacityAsync().catch(() => null),
  ])

  return { lines, totalBytes, freeBytes, capacityBytes }
}

/**
 * Sizes in words a non-technical reader can act on. Below a kilobyte we deliberately say
 * "almost nothing" rather than print a number that means nothing to most people.
 */
export function describeBytes(bytes: number): string {
  if (bytes < 1024) return 'almost nothing'
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
