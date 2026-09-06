import * as FileSystem from 'expo-file-system'
import { Directory, File, Paths } from 'expo-file-system'
import * as store from '@/lib/db/sqlite'
import { S } from '@/lib/strings'

/**
 * "Space used" (REQUIREMENTS.md #41).
 *
 * A privacy-first app that keeps everything on the device owes the user a plain answer to
 * "how much room is this taking?".
 *
 * It has to be the answer the PHONE would give. This used to sum the JSON text length of the
 * rows, which reported 9 KB while Android's own app info said 3.72 MB of data and 15 MB of
 * cache. Row bytes ignore the database file's real size on disk, every sound the user chose,
 * and the whole cache — so the one number the user could check against their phone was the
 * one number that was wrong, which is worse than not showing it.
 */

export interface StorageLine {
  key: store.Collection
  label: string
  rows: number
  bytes: number
}

export interface StorageReport {
  lines: StorageLine[]
  /** What the rows contain. Useful detail, but NOT what the phone reports. */
  contentBytes: number
  /** The database file as it really sits on disk, including its write-ahead log. */
  databaseBytes: number
  /** Sounds the user chose. Usually the largest thing here. */
  soundBytes: number
  /** Scratch files. Reclaimable, and the user can clear them. */
  cacheBytes: number
  /** Everything above: the number that should match the phone's own figure. */
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

/**
 * Add up a directory, including everything nested inside it.
 *
 * Returns 0 rather than throwing for a directory that does not exist yet — a first run has no
 * sounds folder, and that is not an error worth surfacing.
 */
export function directoryBytes(dir: Directory): number {
  let total = 0
  try {
    if (!dir.exists) return 0
    for (const entry of dir.list()) {
      if (entry instanceof File) {
        total += entry.size ?? 0
      } else if (entry instanceof Directory) {
        total += directoryBytes(entry)
      }
    }
  } catch {
    // An unreadable directory contributes what we could count, not a crash.
  }
  return total
}

export async function readStorageReport(): Promise<StorageReport> {
  const lines: StorageLine[] = store.ALL_COLLECTIONS.map((key) => ({
    key,
    label: LABELS[key],
    rows: store.rowCount(key),
    bytes: store.collectionBytes(key),
  }))

  const contentBytes = lines.reduce((sum, l) => sum + l.bytes, 0)

  // The whole SQLite folder, not just the .db: the write-ahead log can be larger than the
  // database itself, and the phone counts it either way.
  const databaseBytes = directoryBytes(new Directory(Paths.document, 'SQLite'))
  const soundBytes = directoryBytes(new Directory(Paths.document, 'sounds'))
  const cacheBytes = directoryBytes(new Directory(Paths.cache))

  const [freeBytes, capacityBytes] = await Promise.all([
    FileSystem.getFreeDiskStorageAsync().catch(() => null),
    FileSystem.getTotalDiskCapacityAsync().catch(() => null),
  ])

  return {
    lines,
    contentBytes,
    databaseBytes,
    soundBytes,
    cacheBytes,
    totalBytes: databaseBytes + soundBytes + cacheBytes,
    freeBytes,
    capacityBytes,
  }
}

/**
 * Delete scratch files.
 *
 * Safe by construction: the cache holds nothing the app needs. Everything the user made lives
 * in the document directory, which this never touches.
 */
export function clearTemporaryFiles(): number {
  const cache = new Directory(Paths.cache)
  const before = directoryBytes(cache)
  try {
    for (const entry of cache.list()) {
      try {
        entry.delete()
      } catch {
        // A file in use stays; the rest still goes.
      }
    }
  } catch {
    return 0
  }
  return Math.max(0, before - directoryBytes(cache))
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
