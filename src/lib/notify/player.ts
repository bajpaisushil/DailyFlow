import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { soundUri } from './customSound'

/**
 * Playing a reminder's chosen sound.
 *
 * Configured to keep playing when the phone is on silent and when the screen locks, because a
 * reminder the user deliberately attached a sound to is one they mean to hear. `shouldRouteThroughEarpiece`
 * stays off so it comes out of the speaker rather than the earpiece.
 *
 * Only one sound plays at a time: two reminders talking over each other is worse than either.
 */

let current: AudioPlayer | null = null
let configured = false

async function configureOnce(): Promise<void> {
  if (configured) return
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    })
    configured = true
  } catch {
    // Older or restricted devices; playback may still work with the defaults.
  }
}

export interface PlayOptions {
  /** Repeat until stopped. Used by alarms, never by ordinary reminders. */
  loop?: boolean
  /** Stop automatically after this long, so a looping alarm cannot run forever. */
  stopAfterSeconds?: number
}

/**
 * The bundled tones, as module references.
 *
 * Required statically so Metro includes them in the bundle — a dynamic path would resolve to
 * nothing at runtime, which is how a preview button ends up silently doing nothing.
 */
const BUNDLED: Record<string, number> = {
  chime: require('../../../assets/sounds/chime.wav'),
  bell: require('../../../assets/sounds/bell.wav'),
  rise: require('../../../assets/sounds/rise.wav'),
  ping: require('../../../assets/sounds/ping.wav'),
  alarm: require('../../../assets/sounds/alarm.wav'),
  knock: require('../../../assets/sounds/knock.wav'),
}

/**
 * Play one of the bundled tones, so it can be heard before it is chosen.
 * 'default' is the phone's own notification sound, which we cannot play ourselves.
 */
export async function previewTone(toneId: string): Promise<boolean> {
  const asset = BUNDLED[toneId]
  if (!asset) return false

  await configureOnce()
  await stopSound()

  try {
    const player = createAudioPlayer(asset)
    player.play()
    current = player
    return true
  } catch {
    current = null
    return false
  }
}

/** Play a stored sound by file name. Returns false when there is nothing to play. */
export async function playSound(fileName: string | undefined, options: PlayOptions = {}): Promise<boolean> {
  const uri = soundUri(fileName)
  if (!uri) return false

  await configureOnce()
  await stopSound()

  try {
    const player = createAudioPlayer({ uri })
    player.loop = options.loop ?? false
    player.play()
    current = player

    if (options.stopAfterSeconds && options.stopAfterSeconds > 0) {
      // A looping alarm that nobody stops must still stop by itself, or it runs the battery
      // flat and becomes the reason the app is uninstalled.
      setTimeout(() => void stopSound(), options.stopAfterSeconds * 1000)
    }
    return true
  } catch {
    current = null
    return false
  }
}

export async function stopSound(): Promise<void> {
  const player = current
  current = null
  if (!player) return
  try {
    player.pause()
    player.remove()
  } catch {
    // Already released.
  }
}

export function isPlaying(): boolean {
  try {
    return current?.playing ?? false
  } catch {
    return false
  }
}
