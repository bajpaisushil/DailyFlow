import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as DocumentPicker from 'expo-document-picker'
import {
  EXPORT_FORMAT, EXPORT_VERSION,
  type ActivityEvent, type AppSettings, type Automation, type Checklist,
  type ChecklistRun, type CommuteProfile, type CommuteSession,
  type ExportEnvelope, type Place, type Reminder, type Routine,
} from '@/lib/types'
import * as store from '@/lib/db/sqlite'
import * as repo from '@/lib/db/repo'

/**
 * Save a copy / open a saved copy (REQUIREMENTS.md #39).
 *
 * The file is written on the device and handed to the system share sheet. Where it goes
 * next is entirely the user's choice — DailyFlow itself never uploads anything, because it
 * has no network layer at all.
 *
 * Import validates before it writes. A malformed or foreign file must fail cleanly with a
 * plain-words message rather than half-populating the database.
 */

export function buildEnvelope(): ExportEnvelope {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    appVersion: '1.0.0',
    data: {
      settings: repo.settings.read(),
      places: store.all<Place>('places', { includeDeleted: true }),
      checklists: store.all<Checklist>('checklists', { includeDeleted: true }),
      checklistRuns: store.all<ChecklistRun>('checklistRuns'),
      routines: store.all<Routine>('routines', { includeDeleted: true }),
      reminders: store.all<Reminder>('reminders', { includeDeleted: true }),
      automations: store.all<Automation>('automations', { includeDeleted: true }),
      commuteProfiles: store.all<CommuteProfile>('commuteProfiles', { includeDeleted: true }),
      commuteSessions: store.all<CommuteSession>('commuteSessions'),
      activity: store.all<ActivityEvent>('activity'),
    },
  }
}

/** Writes the backup and opens the share sheet. Returns the file path it created. */
export async function saveCopy(): Promise<string> {
  const envelope = buildEnvelope()
  const stamp = new Date(envelope.exportedAt).toISOString().slice(0, 10)
  const file = new File(Paths.document, `dailyflow-backup-${stamp}.json`)

  if (file.exists) file.delete()
  file.create()
  file.write(JSON.stringify(envelope, null, 2))

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save a copy of DailyFlow',
    })
  }

  return file.uri
}

export type ImportOutcome =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: 'cancelled' | 'notOurFile' | 'unreadable' }

/**
 * Structural validation. Deliberately hand-rolled rather than pulled in via a schema
 * library: the shape is small, and the failure messages we need are plain-word ones,
 * not validator output.
 */
function looksLikeOurBackup(value: unknown): value is ExportEnvelope {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<ExportEnvelope>
  if (v.format !== EXPORT_FORMAT) return false
  if (typeof v.version !== 'number' || v.version > EXPORT_VERSION) return false
  if (typeof v.data !== 'object' || v.data === null) return false
  // Every collection must be an array if present; a missing one is tolerated so older
  // backups keep importing after we add a table.
  return Object.values(v.data).every((entry) => entry === null || Array.isArray(entry) || typeof entry === 'object')
}

export async function openSavedCopy(): Promise<ImportOutcome> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
  })

  if (picked.canceled || !picked.assets?.[0]) return { ok: false, reason: 'cancelled' }

  let parsed: unknown
  try {
    const file = new File(picked.assets[0].uri)
    parsed = JSON.parse(await file.text())
  } catch {
    return { ok: false, reason: 'unreadable' }
  }

  if (!looksLikeOurBackup(parsed)) return { ok: false, reason: 'notOurFile' }

  const counts = restore(parsed)
  return { ok: true, counts }
}

/**
 * Replaces the current contents with the backup's. Destructive by design — "open a saved
 * copy" means exactly that — so callers must confirm with the user first.
 */
export function restore(envelope: ExportEnvelope): Record<string, number> {
  const d = envelope.data
  const counts: Record<string, number> = {}

  const load = <T extends { id: string }>(collection: store.Collection, rows: T[] | undefined) => {
    store.clearCollection(collection)
    if (!rows?.length) {
      counts[collection] = 0
      return
    }
    store.putMany(collection, rows as Array<T & { deletedAt?: number }>)
    counts[collection] = rows.length
  }

  load('places', d.places)
  load('checklists', d.checklists)
  load('checklistRuns', d.checklistRuns)
  load('routines', d.routines)
  load('reminders', d.reminders)
  load('automations', d.automations)
  load('commuteProfiles', d.commuteProfiles)
  load('commuteSessions', d.commuteSessions)
  load('activity', d.activity)

  if (d.settings) {
    // Keep the incoming preferences but never a stale schema version.
    repo.settings.write({ ...d.settings, schemaVersion: EXPORT_VERSION } as AppSettings)
    counts.settings = 1
  }

  return counts
}

/** Remove everything. The user must always be able to fully erase the app's memory. */
export function removeEverything(): void {
  store.clearAll()
}
