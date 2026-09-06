import * as DocumentPicker from 'expo-document-picker'
import { Directory, File, Paths } from 'expo-file-system'
import { newId } from '@/lib/id'

/**
 * A sound of the user's own choosing for a particular reminder.
 *
 * The file is COPIED into the app's own storage rather than referenced where it was picked.
 * A content:// URI handed back by the picker is a temporary grant — it stops working after a
 * reboot, and the file itself can be moved or deleted from the gallery. Copying costs a few
 * megabytes and means the reminder still has its sound in a year.
 *
 * HONEST LIMIT, stated in the UI rather than buried here: the OS will never play this file
 * for a notification. Android fixes a channel's sound when the channel is created and reads it
 * from the app's own compiled-in resources; iOS needs its sounds in the bundle at build time.
 * A file chosen at runtime is neither.
 *
 * So DailyFlow plays it itself. AlarmManager wakes the native module at the right moment and
 * it plays the file through — the same route the full-screen alarms take, in a quieter mode
 * that leaves an ordinary notification behind (see `wantsOwnSound`). Where that native module
 * is absent — iOS, Expo Go — the file genuinely cannot sound while the app is closed, and the
 * sound picker says so instead of letting someone find out at 6am.
 */

/** Where chosen sounds live. Inside app storage, so they are removed with the app. */
function soundsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'sounds')
  if (!dir.exists) dir.create({ intermediates: true })
  return dir
}

export interface ChosenSound {
  /** Stable file name inside app storage. */
  fileName: string
  /** What to show the user — the original name they recognise. */
  label: string
  uri: string
}

/**
 * The largest file a reminder's sound may be.
 *
 * 50 MB is roughly an hour of ordinary MP3, which comfortably covers a recorded message, a
 * song, or a recitation — the things people actually attach. The limit exists at all because
 * the file is COPIED into app storage and kept for the life of the reminder, so it is charged
 * against the phone rather than borrowed; the storage screen shows what these are costing.
 *
 * It was 8 MB, which rejected most full-length tracks.
 */
const MAX_BYTES = 50 * 1024 * 1024

/** For messages. Kept next to the limit so the two can never disagree. */
export const MAX_SOUND_MB = Math.round(MAX_BYTES / (1024 * 1024))

export type PickResult =
  | { ok: true; sound: ChosenSound }
  | { ok: false; reason: 'cancelled' | 'tooLarge' | 'failed' }

export async function pickSound(): Promise<PickResult> {
  try {
    const picked = await DocumentPicker.getDocumentAsync({
      type: ['audio/*', 'video/mp4'],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (picked.canceled || !picked.assets?.[0]) return { ok: false, reason: 'cancelled' }

    const asset = picked.assets[0]
    if (typeof asset.size === 'number' && asset.size > MAX_BYTES) {
      // Rejected, but the picker has already cached a copy. Remove it, or refusing a big file
      // would cost exactly as much disk as accepting it.
      try {
        new File(asset.uri).delete()
      } catch {
        // Nothing to reclaim.
      }
      return { ok: false, reason: 'tooLarge' }
    }

    const source = new File(asset.uri)
    const extension = extensionOf(asset.name ?? asset.uri)
    const fileName = `${newId()}${extension}`
    const destination = new File(soundsDirectory(), fileName)

    /**
     * copySync, not copy.
     *
     * `File.copy()` returns a Promise. It was called without awaiting and the source was
     * deleted on the very next line, so the copy raced the delete: the sound could end up
     * truncated or absent, and `soundUri` then returns null — a reminder that silently loses
     * the sound the user chose for it.
     */
    source.copySync(destination)

    // Prove the copy landed before claiming success or deleting anything.
    if (!destination.exists || (destination.size ?? 0) === 0) {
      return { ok: false, reason: 'failed' }
    }

    /**
     * Delete the picker's own copy.
     *
     * `copyToCacheDirectory` duplicates the chosen file into the cache so we can read it —
     * and then leaves it there forever. Every sound the user ever auditioned was being kept
     * twice, and with files of up to 50 MB that is how an app quietly accumulates hundreds of
     * megabytes the user cannot account for. We have our own copy now; this one is rubbish.
     */
    try {
      source.delete()
    } catch {
      // A cache file that will not delete is the OS's to reclaim, not a reason to fail.
    }

    return {
      ok: true,
      sound: {
        fileName,
        label: asset.name ?? 'Chosen sound',
        uri: destination.uri,
      },
    }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

function extensionOf(name: string): string {
  const match = /\.([a-zA-Z0-9]{1,5})$/.exec(name)
  return match ? `.${match[1]!.toLowerCase()}` : '.mp3'
}

/** The playable path for a stored sound, or null if the file has gone. */
export function soundUri(fileName: string | undefined): string | null {
  if (!fileName) return null
  try {
    const file = new File(soundsDirectory(), fileName)
    return file.exists ? file.uri : null
  } catch {
    return null
  }
}

/** Remove a sound no reminder uses any more, so storage does not grow forever. */
export function deleteSound(fileName: string): void {
  try {
    const file = new File(soundsDirectory(), fileName)
    if (file.exists) file.delete()
  } catch {
    // Already gone, which is the desired end state anyway.
  }
}

/**
 * Every sound the user has already chosen, newest first.
 *
 * So a file picked for one reminder can be reused on another with a tap, instead of hunting
 * through the file system again for something already sitting in app storage. It also makes
 * the storage honest: these files exist, and this is what is holding them.
 */
export function savedSounds(labels: Record<string, string> = {}): ChosenSound[] {
  try {
    return soundsDirectory()
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .sort((a, b) => (b.modificationTime ?? 0) - (a.modificationTime ?? 0))
      .map((file) => ({
        fileName: file.name,
        label: labels[file.name] ?? file.name,
        uri: file.uri,
      }))
  } catch {
    return []
  }
}

/** Remove any stored sound no reminder refers to any more. */
export function pruneUnusedSounds(inUse: Iterable<string>): number {
  const keep = new Set(inUse)
  let removed = 0
  try {
    for (const entry of soundsDirectory().list()) {
      if (!(entry instanceof File)) continue
      if (keep.has(entry.name)) continue
      entry.delete()
      removed += 1
    }
  } catch {
    // Storage is not critical; leaving a file costs disk, not correctness.
  }
  return removed
}

/** Total bytes of chosen sounds, for the storage panel. */
export function soundsBytes(): number {
  try {
    return soundsDirectory()
      .list()
      .reduce((sum, entry) => sum + (entry instanceof File ? (entry.size ?? 0) : 0), 0)
  } catch {
    return 0
  }
}
