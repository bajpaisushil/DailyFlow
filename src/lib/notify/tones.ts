/**
 * The sounds a reminder can make.
 *
 * These are bundled with the app, which is what makes a per-reminder sound work AT ALL while
 * DailyFlow is closed. Android fixes a notification's sound when its channel is created and
 * reads it from the app's own resources — so a file chosen at runtime cannot be that sound,
 * but a bundled one can, and a separate channel per tone gives each reminder its own.
 *
 * They are synthesised rather than sourced: no licence, no attribution, no download, and each
 * is built to be distinguishable BY EAR so the user can tell which reminder is sounding
 * without looking at the phone — which matters most for the people this app is for.
 */

export interface Tone {
  id: ToneId
  label: string
  /** Bundled resource name, without extension. Android channel + iOS sound both use this. */
  file: string
  description: string
}

export type ToneId = 'chime' | 'bell' | 'rise' | 'ping' | 'alarm' | 'knock' | 'default'

export const TONES: Tone[] = [
  { id: 'default', label: 'Phone default', file: 'default', description: 'Your usual notification sound' },
  { id: 'chime', label: 'Chime', file: 'chime', description: 'Two soft notes' },
  { id: 'bell', label: 'Bell', file: 'bell', description: 'One calm ring' },
  { id: 'rise', label: 'Rise', file: 'rise', description: 'Three notes going up' },
  { id: 'ping', label: 'Ping', file: 'ping', description: 'Two quick beeps' },
  { id: 'knock', label: 'Knock', file: 'knock', description: 'Low and quiet' },
  { id: 'alarm', label: 'Alarm', file: 'alarm', description: 'Repeating, hard to ignore' },
]

export function toneById(id: string | undefined): Tone {
  return TONES.find((t) => t.id === id) ?? TONES[0]!
}

/**
 * The Android channel a tone needs.
 *
 * One channel per tone, because a channel's sound cannot be changed after it is created —
 * so "unique sound per reminder" is achieved by having a channel per sound rather than by
 * trying to mutate one.
 */
export function channelIdForTone(toneId: ToneId, alarm: boolean): string {
  if (alarm) return `alarm-${toneId}`
  return `reminder-${toneId}`
}

/** The value expo-notifications wants: a bundled resource name, or 'default'. */
export function soundNameForTone(toneId: ToneId): string {
  const tone = toneById(toneId)
  return tone.file === 'default' ? 'default' : `${tone.file}.wav`
}
