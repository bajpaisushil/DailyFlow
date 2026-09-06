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
/**
 * How a firing behaves.
 *
 * 'alarm' takes over the screen and repeats until stopped. 'sound' plays the user's chosen
 * audio through once and leaves an ordinary notification behind — the only way a file the
 * user picked can be the sound they actually hear, since an Android notification channel can
 * only sound a file compiled into the app and can never change its sound once created.
 */
export type FiringStyle = 'alarm' | 'sound'

/**
 * The events the native side pushes up.
 *
 * `addListener` is redeclared below rather than inherited: expo's NativeModule declaration
 * reaches EventEmitter through a type-only import, so its members do not survive into an
 * interface that extends it. Naming the one event we use keeps the call site typed.
 */
type AlarmEvents = {
  onRingingChange: (event: { ringing: boolean }) => void
}

interface AlarmModule extends NativeModule<AlarmEvents> {
  addListener<E extends keyof AlarmEvents>(
    event: E,
    listener: AlarmEvents[E],
  ): { remove(): void }

  canShowFullScreen(): boolean
  openFullScreenSettings(): boolean
  isRinging(): boolean
  ring(
    title: string,
    body: string | null,
    soundUri: string | null,
    durationSeconds: number,
    vibrate: boolean,
    style: FiringStyle | null,
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
    style: FiringStyle | null,
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

/**
 * Subscribe to whether an alarm is sounding.
 *
 * The app needs this to offer a Stop while it is open. Until now it offered none: the only
 * Stop in existence was on the full-screen alarm screen, which Android shows solely when the
 * phone is locked — so an alarm that went off while someone was using their phone could not be
 * silenced from inside DailyFlow at all.
 *
 * Returns an unsubscribe function. Safe where the module does not exist: the callback simply
 * never fires.
 */
export function onAlarmRingingChange(listener: (ringing: boolean) => void): () => void {
  if (!native) return () => {}
  try {
    const subscription = native.addListener('onRingingChange', (event: { ringing: boolean }) => {
      listener(event?.ringing === true)
    })
    return () => {
      try {
        subscription.remove()
      } catch {
        // Already gone.
      }
    }
  } catch {
    return () => {}
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
  /** Defaults to 'alarm'. 'sound' previews a reminder's own audio without the alarm screen. */
  style?: FiringStyle
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
      options.style ?? 'alarm',
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
 * What happened to a scheduled firing.
 *
 * 'inexact' and 'failed' were once the same `false`, which was dangerous: the notification
 * scheduler skips reminders this path has claimed, so a failure that looked like a mere
 * imprecision meant the reminder made no sound AND was never posted. It simply vanished.
 *
 * 'inexact' — scheduled, but Android would not grant an exact alarm, so it may drift by
 * minutes. The UI should say so rather than let someone trust a 6am alarm that is not precise.
 * 'failed' — not scheduled at all. The caller must not claim the reminder.
 */
export type ScheduleOutcome = 'exact' | 'inexact' | 'failed'

/** Schedule an alarm for a wall-clock moment. */
export function scheduleAlarm(input: {
  id: string
  at: number
  title: string
  body?: string
  soundUri?: string
  durationSeconds?: number
  vibrate?: boolean
  style?: FiringStyle
}): ScheduleOutcome {
  if (!native) return 'failed'
  try {
    const exact = native.schedule(
      input.id,
      input.at,
      input.title,
      input.body ?? null,
      input.soundUri ?? null,
      input.durationSeconds ?? 60,
      input.vibrate ?? true,
      input.style ?? 'alarm',
    )
    return exact ? 'exact' : 'inexact'
  } catch {
    return 'failed'
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
