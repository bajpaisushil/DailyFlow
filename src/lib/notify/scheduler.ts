import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import type { Automation, NotificationPriority, Weekday } from '@/lib/types'
import { parseHHMM } from '@/lib/time'

/**
 * Notification scheduling.
 *
 * This is the capability that justified going native. The OS itself holds the schedule and
 * fires the reminder — with DailyFlow fully closed, with no server, and with nothing ever
 * leaving the phone. On the web this was provably impossible: Notification Triggers was
 * cancelled, a service worker is killed after ~30s idle, and Web Push both requires a server
 * and (per RFC 8030) cannot express "fire at 06:45" at all.
 *
 * Two platform limits shape the design:
 *  - iOS keeps at most 64 pending local notifications. We budget well under that.
 *  - A "weekdays at 06:45" rule becomes five weekly triggers, so a naive scheduler burns
 *    the budget fast. `planFor` collapses all-seven-days into a single daily trigger.
 */

/** iOS's hard ceiling is 64; we stay clear of it so nothing is silently dropped. */
export const MAX_PENDING = 56

export const CHANNEL_ID = 'reminders'
export const CHANNEL_QUIET = 'reminders-quiet'

export type PermissionState = 'granted' | 'denied' | 'undetermined'

/**
 * How a notification behaves when it arrives while the app is open. Reminders are worth
 * showing even in the foreground — that is the entire point of the product.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function readPermission(): Promise<PermissionState> {
  const res = await Notifications.getPermissionsAsync()
  if (res.granted) return 'granted'
  return res.canAskAgain ? 'undetermined' : 'denied'
}

/** Asked in context, never on launch, and never twice after a refusal. */
export async function requestPermission(): Promise<PermissionState> {
  const current = await Notifications.getPermissionsAsync()
  if (current.granted) return 'granted'
  if (!current.canAskAgain) return 'denied'
  const res = await Notifications.requestPermissionsAsync()
  return res.granted ? 'granted' : 'denied'
}

/**
 * Android routes notifications through channels, and the channel — not the payload —
 * owns importance and vibration. Two channels let "quiet" reminders genuinely stay quiet.
 */
export async function ensureChannels(vibrate: boolean): Promise<void> {
  if (Platform.OS !== 'android') return

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: vibrate ? [0, 220, 120, 220] : undefined,
    enableVibrate: vibrate,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  })

  await Notifications.setNotificationChannelAsync(CHANNEL_QUIET, {
    name: 'Quiet reminders',
    importance: Notifications.AndroidImportance.LOW,
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  })
}

/** expo-notifications counts weekdays 1..7 starting at Sunday; our model uses 0..6. */
function toExpoWeekday(day: Weekday): number {
  return day + 1
}

export interface ScheduledPlan {
  /** Stable identifier so we can reconcile rather than cancel-and-recreate everything. */
  key: string
  automationId: string
  title: string
  body?: string
  priority: NotificationPriority
  trigger: Notifications.NotificationTriggerInput
}

/**
 * Turn one automation into the concrete OS-level schedules it needs.
 * Returns an empty array when the automation cannot be expressed as a fixed clock time —
 * location and state triggers are handled by the geofence and the in-app engine instead.
 */
export function planFor(automation: Automation): ScheduledPlan[] {
  if (!automation.enabled) return []
  if (automation.trigger.kind !== 'time.at') return []

  const notify = automation.actions.find((a) => a.kind === 'notify')
  if (!notify || notify.kind !== 'notify') return []

  const minutes = parseHHMM(automation.trigger.params.time)
  if (minutes == null) return []

  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  // Day restriction comes from a day condition; absent one, the rule runs every day.
  const dayCondition = automation.conditions.find((c) => c.kind === 'day.isOneOf')
  const days: Weekday[] =
    dayCondition && dayCondition.kind === 'day.isOneOf' && !dayCondition.negate
      ? dayCondition.params.days
      : [0, 1, 2, 3, 4, 5, 6]

  if (days.length === 0) return []

  const base = {
    automationId: automation.id,
    title: notify.params.title,
    body: notify.params.body,
    priority: notify.params.priority,
  }

  // Seven days collapses to one daily trigger — a 7x saving against the pending-notification cap.
  if (days.length === 7) {
    return [{
      ...base,
      key: `${automation.id}:daily`,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    }]
  }

  return days.map((day) => ({
    ...base,
    key: `${automation.id}:w${day}`,
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: toExpoWeekday(day),
      hour,
      minute,
    },
  }))
}

/**
 * Reconcile the OS schedule with what the automations currently say.
 *
 * Cancel-everything-then-reschedule is the only reliable approach: expo-notifications gives
 * us no way to mutate an existing schedule, and identifiers do not survive a reinstall.
 * The operation is cheap because the set is small and bounded.
 */
export async function syncSchedules(
  automations: Automation[],
  opts: { vibrate: boolean },
): Promise<{ scheduled: number; skipped: number }> {
  const permission = await readPermission()
  if (permission !== 'granted') return { scheduled: 0, skipped: 0 }

  await ensureChannels(opts.vibrate)
  await Notifications.cancelAllScheduledNotificationsAsync()

  const plans = automations.flatMap(planFor)
  const budgeted = plans.slice(0, MAX_PENDING)

  for (const plan of budgeted) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: plan.title,
        body: plan.body,
        sound: plan.priority !== 'quiet',
        priority:
          plan.priority === 'important'
            ? Notifications.AndroidNotificationPriority.MAX
            : plan.priority === 'quiet'
              ? Notifications.AndroidNotificationPriority.LOW
              : Notifications.AndroidNotificationPriority.HIGH,
        // Carried through so a tap can open the right screen and the engine can log the firing.
        data: { automationId: plan.automationId, key: plan.key },
      },
      trigger: plan.trigger,
    })
  }

  return { scheduled: budgeted.length, skipped: plans.length - budgeted.length }
}

/** Show something right now — used by snooze and by in-app engine actions. */
export async function notifyNow(input: {
  title: string
  body?: string
  priority?: NotificationPriority
  inSeconds?: number
}): Promise<void> {
  const permission = await readPermission()
  if (permission !== 'granted') return

  await Notifications.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body,
      sound: (input.priority ?? 'normal') !== 'quiet',
    },
    trigger: input.inSeconds
      ? { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: input.inSeconds }
      : null,
  })
}

export async function pendingCount(): Promise<number> {
  const all = await Notifications.getAllScheduledNotificationsAsync()
  return all.length
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync()
}
