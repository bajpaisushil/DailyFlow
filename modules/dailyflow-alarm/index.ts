import { NativeModule, requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'

/**
 * A real alarm: a full-screen activity over the lock screen, looping sound, and a foreground
 * service so Android cannot silence it.
 *
 * Android only. iOS does not permit a third-party app to take over the screen and ring —
 * that is Apple's Clock app alone — so on iOS this reports unavailable and the app falls back
 * to the loudest notification Apple allows, and says so.
 *
 * Loaded with requireOptionalNativeModule so a JS-only context (Expo Go, tests, web) gets
 * null instead of a throw. The notification scheduler learned that lesson the hard way.
 */
interface AlarmModule extends NativeModule {
  canShowFullScreen(): boolean
  openFullScreenSettings(): boolean
  isRinging(): boolean
  ring(
    title: string,
    body: string | null,
    soundUri: string | null,
    durationSeconds: number,
    vibrate: boolean,
  ): boolean
  stop(): boolean
}

const native = requireOptionalNativeModule<AlarmModule>('DailyFlowAlarm')

/** Whether this build has the alarm module at all. */
export function alarmModuleAvailable(): boolean {
  return Platform.OS === 'android' && native != null
}

/**
 * Whether a full-screen alarm will actually appear.
 *
 * From Android 14 the full-screen-intent permission is granted only to apps the user
 * classifies as alarms or calls. Without it the alarm still sounds but does not take over the
 * screen — a real difference, so the UI asks rather than assuming.
 */
export function canShowFullScreenAlarm(): boolean {
  try {
    return native?.canShowFullScreen() ?? false
  } catch {
    return false
  }
}

export function openFullScreenAlarmSettings(): void {
  try {
    native?.openFullScreenSettings()
  } catch {
    // The settings page does not exist below Android 14, which is fine: there the permission
    // is granted automatically.
  }
}

export function isAlarmRinging(): boolean {
  try {
    return native?.isRinging() ?? false
  } catch {
    return false
  }
}

export interface RingOptions {
  title: string
  body?: string
  /** A file:// or content:// URI. Falls back to the system alarm tone when absent. */
  soundUri?: string
  /** How long it rings before stopping itself. Clamped to 15 minutes natively. */
  durationSeconds?: number
  vibrate?: boolean
}

/** Start ringing. Returns false when this build cannot. */
export function ringAlarm(options: RingOptions): boolean {
  if (!native) return false
  try {
    return native.ring(
      options.title,
      options.body ?? null,
      options.soundUri ?? null,
      options.durationSeconds ?? 60,
      options.vibrate ?? true,
    )
  } catch {
    return false
  }
}

export function stopAlarm(): void {
  try {
    native?.stop()
  } catch {
    // Nothing ringing, or no module.
  }
}
