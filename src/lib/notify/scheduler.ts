import { Platform } from 'react-native'
import type { Automation, NotificationPriority } from '@/lib/types'
import { supportsScheduledNotifications } from '@/lib/runtime'
import { MAX_PENDING, planFor, type ScheduledPlan, type TriggerPlan } from './plan'

export { MAX_PENDING, planFor } from './plan'
export type { ScheduledPlan, TriggerPlan } from './plan'

/**
 * Notification scheduling.
 *
 * This is the capability that justified going native: the OS itself holds the schedule and
 * fires the reminder with DailyFlow fully closed, with no server, and with nothing leaving
 * the phone.
 *
 * IMPORTANT — why expo-notifications is loaded lazily rather than imported at the top:
 * in Expo Go (SDK 53+) the module THROWS THE MOMENT IT IS IMPORTED, because Android push was
 * removed from the sandbox app. A top-level import therefore takes down every screen that
 * transitively reaches this file, which is all of them. Loading it on demand behind a
 * try/catch keeps the whole app usable in Expo Go, with only the reminder features degraded
 * — and the UI says so rather than pretending.
 *
 * Two platform limits shape the design:
 *  - iOS keeps at most 64 pending local notifications, so we budget under that.
 *  - "Weekdays at 06:45" becomes five weekly triggers, so `planFor` collapses all-seven-days
 *    into a single daily trigger to avoid burning the budget.
 */

export const CHANNEL_ID = 'reminders'
export const CHANNEL_QUIET = 'reminders-quiet'

export type PermissionState = 'granted' | 'denied' | 'undetermined'

type NotificationsModule = typeof import('expo-notifications')

/** `undefined` = not tried yet, `null` = unavailable on this build. */
let cached: NotificationsModule | null | undefined

/**
 * Resolve expo-notifications, or null where it cannot work. Never throws: an unavailable
 * notifications module is an expected state, not an error condition.
 */
function load(): NotificationsModule | null {
  if (cached !== undefined) return cached
  if (!supportsScheduledNotifications) {
    cached = null
    return null
  }
  try {
    // Deliberately require(), not import: this must be able to fail without unwinding
    // the module graph. eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-notifications') as NotificationsModule
    cached.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    })
  } catch {
    cached = null
  }
  return cached
}

/** Whether this build can schedule reminders at all. Drives the honest UI badges. */
export function notificationsAvailable(): boolean {
  return load() != null
}

export async function readPermission(): Promise<PermissionState> {
  const N = load()
  if (!N) return 'denied'
  try {
    const res = await N.getPermissionsAsync()
    if (res.granted) return 'granted'
    return res.canAskAgain ? 'undetermined' : 'denied'
  } catch {
    return 'denied'
  }
}

/** Asked in context, never on launch, and never twice after a refusal. */
export async function requestPermission(): Promise<PermissionState> {
  const N = load()
  if (!N) return 'denied'
  try {
    const current = await N.getPermissionsAsync()
    if (current.granted) return 'granted'
    if (!current.canAskAgain) return 'denied'
    const res = await N.requestPermissionsAsync()
    return res.granted ? 'granted' : 'denied'
  } catch {
    return 'denied'
  }
}

/**
 * Android routes notifications through channels, and the channel — not the payload — owns
 * importance and vibration. Two channels let "quiet" reminders genuinely stay quiet.
 */
export async function ensureChannels(vibrate: boolean): Promise<void> {
  const N = load()
  if (!N || Platform.OS !== 'android') return
  try {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Reminders',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: vibrate ? [0, 220, 120, 220] : undefined,
      enableVibrate: vibrate,
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
    })
    await N.setNotificationChannelAsync(CHANNEL_QUIET, {
      name: 'Quiet reminders',
      importance: N.AndroidImportance.LOW,
      enableVibrate: false,
      lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
    })
  } catch {
    // A channel that cannot be created simply means the default is used.
  }
}

/** expo-notifications counts weekdays 1..7 starting at Sunday; our model uses 0..6. */
function toNativeTrigger(N: NotificationsModule, when: TriggerPlan) {
  if (when.every === 'day') {
    return {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour: when.hour,
      minute: when.minute,
    } as const
  }
  return {
    type: N.SchedulableTriggerInputTypes.WEEKLY,
    weekday: when.weekday + 1,
    hour: when.hour,
    minute: when.minute,
  } as const
}

export interface SyncResult {
  scheduled: number
  skipped: number
  available: boolean
}

/**
 * Reconcile the OS schedule with what the automations currently say.
 *
 * Cancel-then-reschedule is the only reliable approach: expo-notifications offers no way to
 * mutate an existing schedule, and identifiers do not survive a reinstall. It is cheap
 * because the set is small and bounded.
 */
export async function syncSchedules(
  automations: Automation[],
  opts: { vibrate: boolean },
): Promise<SyncResult> {
  const N = load()
  if (!N) return { scheduled: 0, skipped: 0, available: false }

  const permission = await readPermission()
  if (permission !== 'granted') return { scheduled: 0, skipped: 0, available: true }

  await ensureChannels(opts.vibrate)

  try {
    await N.cancelAllScheduledNotificationsAsync()

    const plans = automations.flatMap(planFor)
    const budgeted = plans.slice(0, MAX_PENDING)

    for (const plan of budgeted) {
      await N.scheduleNotificationAsync({
        content: {
          title: plan.title,
          body: plan.body,
          sound: plan.priority !== 'quiet',
          priority:
            plan.priority === 'important'
              ? N.AndroidNotificationPriority.MAX
              : plan.priority === 'quiet'
                ? N.AndroidNotificationPriority.LOW
                : N.AndroidNotificationPriority.HIGH,
          // Carried through so a tap can open the right screen and the engine can log it.
          data: { automationId: plan.automationId, key: plan.key },
        },
        trigger: toNativeTrigger(N, plan.when),
      })
    }

    return { scheduled: budgeted.length, skipped: plans.length - budgeted.length, available: true }
  } catch {
    return { scheduled: 0, skipped: 0, available: false }
  }
}

/** Show something now — used by snooze and by the geofence's in-task actions. */
export async function notifyNow(input: {
  title: string
  body?: string
  priority?: NotificationPriority
  inSeconds?: number
}): Promise<void> {
  const N = load()
  if (!N) return
  if ((await readPermission()) !== 'granted') return

  try {
    await N.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound: (input.priority ?? 'normal') !== 'quiet',
      },
      trigger: input.inSeconds
        ? { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: input.inSeconds }
        : null,
    })
  } catch {
    // Nothing to recover: the reminder simply is not shown, and the ledger records that.
  }
}

export async function pendingCount(): Promise<number> {
  const N = load()
  if (!N) return 0
  try {
    return (await N.getAllScheduledNotificationsAsync()).length
  } catch {
    return 0
  }
}

export async function cancelAll(): Promise<void> {
  const N = load()
  if (!N) return
  try {
    await N.cancelAllScheduledNotificationsAsync()
  } catch {
    // Nothing scheduled, or the module is unavailable. Either way there is nothing to undo.
  }
}
