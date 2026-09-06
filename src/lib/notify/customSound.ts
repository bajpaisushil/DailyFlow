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
 * HONEST LIMIT, stated in the UI rather than buried here: Android fixes a notification's sound
 * when the channel is created, so a file chosen at runtime CANNOT become the sound the OS plays
 * for a notification while DailyFlow is closed. It plays when the reminder is tapped, when it
 * arrives with the app open, and — the case it really exists for — as the looping sound of a
 * full-screen alarm.
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

/** Roughly a minute of audio. Large enough for any alarm tone, small enough to keep. */
const MAX_BYTES = 8 * 1024 * 1024

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
      return { ok: false, reason: 'tooLarge' }
    }

    const source = new File(asset.uri)
    const extension = extensionOf(asset.name ?? asset.uri)
    const fileName = `${newId()}${extension}`
    const destination = new File(soundsDirectory(), fileName)

    source.copy(destination)

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
