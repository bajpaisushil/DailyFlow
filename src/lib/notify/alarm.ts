import {
  alarmModuleAvailable as moduleAvailable,
  canShowFullScreenAlarm,
  openFullScreenAlarmSettings,
  ringAlarm as ringNative,
  stopAlarm as stopNative,
  isAlarmRinging,
} from '../../../modules/dailyflow-alarm'
import { soundUri } from './customSound'

/**
 * The app's view of the real alarm.
 *
 * Wraps the native module so the rest of the code never has to know whether it exists, and so
 * a sound chosen by the user is resolved to a playable URI in one place.
 *
 * Everything degrades honestly: with no module (Expo Go, iOS) `ringAlarm` returns false and
 * the caller falls back to the loudest notification available, rather than silently doing
 * nothing and leaving someone asleep.
 */

export { canShowFullScreenAlarm, openFullScreenAlarmSettings, isAlarmRinging }

export function alarmModuleAvailable(): boolean {
  return moduleAvailable()
}

export interface AlarmRequest {
  title: string
  body?: string
  /** A stored custom sound file name, or a bundled tone id. */
  soundFile?: string
  /** How long it rings before stopping itself. */
  durationSeconds?: number
  vibrate?: boolean
}

/** Default ring length. Long enough to wake someone, short enough not to flatten a battery. */
export const DEFAULT_ALARM_SECONDS = 60

export function ringAlarm(request: AlarmRequest): boolean {
  return ringNative({
    title: request.title,
    body: request.body,
    // A user-chosen file resolves to a real path; a bundled tone id will not, and the native
    // side then falls back to the system alarm tone rather than ringing silently.
    soundUri: soundUri(request.soundFile) ?? undefined,
    durationSeconds: request.durationSeconds ?? DEFAULT_ALARM_SECONDS,
    vibrate: request.vibrate ?? true,
  })
}

export function stopAlarm(): void {
  stopNative()
}
