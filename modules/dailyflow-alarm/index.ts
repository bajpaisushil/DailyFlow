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
  schedule(
    id: string,
    triggerAtMs: number,
    title: string,
    body: string | null,
    soundUri: string | null,
    durationSeconds: number,
    vibrate: boolean,
  ): boolean
  cancelScheduled(id: string): boolean
  canScheduleExact(): boolean
  openExactAlarmSettings(): boolean
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

/**
 * Schedule an alarm for a wall-clock moment.
 *
 * Returns whether it was scheduled EXACTLY. From Android 12 an exact alarm needs permission;
 * without it the alarm still happens but may drift by minutes, which the UI should say rather
 * than let someone believe a 6am alarm is precise when it is not.
 */
export function scheduleAlarm(input: {
  id: string
  at: number
  title: string
  body?: string
  soundUri?: string
  durationSeconds?: number
  vibrate?: boolean
}): boolean {
  if (!native) return false
  try {
    return native.schedule(
      input.id,
      input.at,
      input.title,
      input.body ?? null,
      input.soundUri ?? null,
      input.durationSeconds ?? 60,
      input.vibrate ?? true,
    )
  } catch {
    return false
  }
}

export function cancelScheduledAlarm(id: string): void {
  try {
    native?.cancelScheduled(id)
  } catch {
    // Never scheduled, or no module.
  }
}

/** Whether alarms will fire at the exact minute, or merely near it. */
export function canScheduleExactAlarms(): boolean {
  try {
    return native?.canScheduleExact() ?? false
  } catch {
    return false
  }
}

export function openExactAlarmSettings(): void {
  try {
    native?.openExactAlarmSettings()
  } catch {
    // Below Android 12 there is no such screen; the permission is implicit.
  }
}
