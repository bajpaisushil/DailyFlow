import { Platform } from 'react-native'
import type { Automation, NotificationPriority } from '@/lib/types'
import { isWithinWindow, parseHHMM } from '@/lib/time'
import { supportsScheduledNotifications } from '@/lib/runtime'
import { channelIdForTone, soundNameForTone, TONES, type ToneId } from './tones'
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
/** Maximum importance, alarm audio stream, bypasses Do Not Disturb. */
export const CHANNEL_ALARM = 'reminders-alarm'

export type PermissionState = 'granted' | 'denied' | 'undetermined'

/** The most recent scheduling failure, shown in the diagnostic rather than hidden. */
let lastError: string | null = null
export function lastSchedulingError(): string | null {
  return lastError
}

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

    /**
     * One channel per tone, and a second per tone for alarms.
     *
     * This is how a sound PER REMINDER is possible at all. Android fixes a channel's sound
     * when the channel is created and never lets it change, so the only way to give two
     * reminders different sounds is to give them different channels. Creating a channel that
     * already exists is a no-op, so this is safe to run on every sync.
     *
     * Alarm channels get MAX importance, a long insistent vibration, and bypassDnd so they
     * still sound when the phone is set to allow alarms only. The user owns a channel once it
     * exists — if they turn one down, we must not turn it back up, and Android correctly
     * will not let us.
     */
    for (const tone of TONES) {
      const sound = soundNameForTone(tone.id)

      await N.setNotificationChannelAsync(channelIdForTone(tone.id, false), {
        name: `Reminders — ${tone.label}`,
        importance: N.AndroidImportance.HIGH,
        sound,
        vibrationPattern: vibrate ? [0, 220, 120, 220] : undefined,
        enableVibrate: vibrate,
        lockscreenVisibility: N.AndroidNotificationVisibility.PRIVATE,
      })

      await N.setNotificationChannelAsync(channelIdForTone(tone.id, true), {
        name: `Alarms — ${tone.label}`,
        importance: N.AndroidImportance.MAX,
        sound,
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        enableVibrate: true,
        bypassDnd: true,
        lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: N.AndroidAudioUsage.ALARM,
          contentType: N.AndroidAudioContentType.SONIFICATION,
          flags: { enforceAudibility: true, requestHardwareAudioVideoSynchronization: false },
        },
      })
    }
  } catch {
    // A channel that cannot be created simply means the default is used.
  }
}

/** expo-notifications counts weekdays 1..7 starting at Sunday; our model uses 0..6. */
function toNativeTrigger(N: NotificationsModule, when: TriggerPlan) {
  // A bounded course schedules each occurrence as its own dated notification, so it expires
  // on its own rather than depending on us to switch it off later.
  if (when.every === 'once') {
    return { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(when.at) } as const
  }
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
/**
 * Does this firing fall inside the user's "do not wake me" window?
 *
 * Exported so the reminder EDITOR can warn before saving. It is deliberately NOT used to
 * filter the schedule any more — see the note in syncSchedules.
 */
export function fallsInQuietHours(
  plan: Pick<ScheduledPlan, 'when' | 'priority'>,
  quiet: { enabled: boolean; from: string; to: string },
): boolean {
  if (!quiet.enabled) return false

  const minutes =
    plan.when.every === 'once'
      ? (() => {
          const d = new Date(plan.when.at)
          return d.getHours() * 60 + d.getMinutes()
        })()
      : plan.when.hour * 60 + plan.when.minute

  return isWithinWindow(minutes, quiet.from, quiet.to)
}

/** Whether a clock time the user is about to save lands inside their quiet hours. */
export function timeIsInQuietHours(
  time: string,
  quiet: { enabled: boolean; from: string; to: string },
): boolean {
  const minutes = parseHHMM(time)
  if (minutes == null) return false
  return fallsInQuietHours(
    { when: { every: 'day', hour: Math.floor(minutes / 60), minute: minutes % 60 }, priority: 'normal' },
    quiet,
  )
}

export async function syncSchedules(
  automations: Automation[],
  opts: { vibrate: boolean; quietHours?: { enabled: boolean; from: string; to: string; allowImportant: boolean } },
): Promise<SyncResult> {
  const N = load()
  if (!N) return { scheduled: 0, skipped: 0, available: false }

  const permission = await readPermission()
  if (permission !== 'granted') return { scheduled: 0, skipped: 0, available: true }

  await ensureChannels(opts.vibrate)

  try {
    await N.cancelAllScheduledNotificationsAsync()

    const plans = automations.flatMap((a) => planFor(a))

    /**
     * Keep the SOONEST firings, not the first ones the loop happened to produce.
     *
     * `slice(0, MAX_PENDING)` truncated in automation order, so a month-long course of three
     * doses a day kept every 08:00 and 14:00 and silently dropped every 21:00 — the user lost
     * an entire dose per day and nothing said so. Ordering by when each will actually fire
     * means what gets dropped is the far future, which the next sync will pick up anyway.
     *
     * Repeating triggers have no single next time, so they are ranked by time of day and kept
     * ahead of dated ones: a daily reminder must never be evicted by a course.
     */
    const rank = (plan: ScheduledPlan): number =>
      plan.when.every === 'once'
        ? plan.when.at
        : Date.now() + (plan.when.hour * 60 + plan.when.minute) * 1000

    /**
     * Quiet hours do NOT remove a reminder from the schedule.
     *
     * An earlier version filtered them out here, and it was worse than the problem it solved:
     * quiet hours default to 22:00–07:00, so "leave for work at 06:45" and the time picker's
     * own "Early 06:00" shortcut were saved, listed, badged green as reachable — and never
     * scheduled at all. A reminder deliberately set for 06:45 is one the user WANTS at 06:45;
     * silence is not what they asked for by enabling a do-not-disturb window.
     *
     * Quiet hours now do what they should: they suppress the app's own INCIDENTAL nudges —
     * the geofence firings that governance.decide() gates — and the editor warns before
     * saving a time that lands inside the window. What the user explicitly asked for is
     * always scheduled, and their phone's own Do Not Disturb remains the final word on
     * whether it makes a noise.
     */
    const ordered = [...plans].sort((a, b) => rank(a) - rank(b))
    const budgeted = ordered.slice(0, MAX_PENDING)

    for (const plan of budgeted) {
      await N.scheduleNotificationAsync({
        content: {
          title: plan.title,
          body: plan.body,
          // Honours the reminder's own "Make a sound" toggle, which was previously ignored.
          sound: !plan.silent && plan.priority !== 'quiet',
          priority:
            plan.priority === 'important'
              ? N.AndroidNotificationPriority.MAX
              : plan.priority === 'quiet'
                ? N.AndroidNotificationPriority.LOW
                : N.AndroidNotificationPriority.HIGH,
          /**
           * iOS has no channels; importance is carried per-notification by the interruption
           * level. Without this, `alertStyle` was read and discarded on iOS — an alarm and an
           * ordinary reminder produced byte-identical requests, so the alarm was swallowed by
           * any Focus mode and held by Scheduled Summary.
           *
           * 'critical' is deliberately not used: it needs an entitlement Apple grants only on
           * application, and shipping without it would mean the level is silently ignored.
           */
          ...(Platform.OS === 'ios'
            ? {
                interruptionLevel:
                  plan.alertStyle === 'alarm' || plan.priority === 'important'
                    ? ('timeSensitive' as const)
                    : plan.priority === 'quiet'
                      ? ('passive' as const)
                      : ('active' as const),
              }
            : {}),
          // An alarm goes to its own maximum-importance channel with the alarm audio
          // stream, so it sounds when the phone is set to allow alarms only.
          ...(Platform.OS === 'android'
            ? {
                // One channel per tone: a channel's sound cannot be changed after creation,
                // so a sound per reminder is achieved by having a channel per sound.
                channelId: channelIdForTone(
                  (plan.toneId as ToneId | undefined) ?? 'chime',
                  plan.alertStyle === 'alarm',
                ),
              }
            : {}),
          // Carried through so a tap can open the right screen and the engine can log it.
          data: { automationId: plan.automationId, key: plan.key },
        },
        trigger: toNativeTrigger(N, plan.when),
      })
    }

    return {
      scheduled: budgeted.length,
      skipped: plans.length - budgeted.length,
      available: true,
    }
  } catch (error) {
    // We have already cancelled everything by this point, so a swallowed failure leaves the
    // user with NO reminders and no indication why. Surface it.
    console.error('[DailyFlow] scheduling failed', error)
    lastError = error instanceof Error ? error.message : String(error)
    return { scheduled: 0, skipped: 0, available: false }
  }
}

/** Show something now — used by snooze and by the geofence's in-task actions. */
export async function notifyNow(input: {
  title: string
  body?: string
  priority?: NotificationPriority
  alertStyle?: 'notification' | 'alarm'
  toneId?: string
  inSeconds?: number
}): Promise<boolean> {
  const N = load()
  if (!N) return false
  if ((await readPermission()) !== 'granted') return false

  try {
    // Android drops a notification to the default channel if the channel it names does not
    // exist yet. Geofence firings arrive through here, often on a cold start where nothing
    // has created the channels, so an alarm silently became an ordinary notification.
    await ensureChannels(true)

    await N.scheduleNotificationAsync({
      content: {
        title: input.title,
        body: input.body,
        sound: (input.priority ?? 'normal') !== 'quiet',
        ...(Platform.OS === 'android'
          ? {
              channelId: channelIdForTone(
                (input.toneId as ToneId | undefined) ?? 'chime',
                input.alertStyle === 'alarm',
              ),
            }
          : {}),
      },
      trigger: input.inSeconds
        ? { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: input.inSeconds }
        : null,
    })
    return true
  } catch {
    // Reported rather than swallowed, so the ledger can record a miss instead of a delivery.
    return false
  }
}

export interface PendingItem {
  id: string
  title: string
  /** Plain description of when it will next fire. */
  when: string
  channel?: string
}

/**
 * What the OPERATING SYSTEM actually holds, read back from it rather than inferred.
 *
 * This exists because "the reminder is scheduled" was, until now, something the app asserted
 * and nobody could check. When reminders did not arrive there was no way to tell a scheduling
 * bug from a permission problem from a device power setting — the app looked identical in all
 * three cases. Reading the real pending list is the difference between debugging and guessing.
 */
export async function pendingNotifications(): Promise<PendingItem[]> {
  const N = load()
  if (!N) return []
  try {
    const all = await N.getAllScheduledNotificationsAsync()
    return all.map((item) => ({
      id: item.identifier,
      title: typeof item.content?.title === 'string' ? item.content.title : '(no title)',
      when: describeTrigger(item.trigger),
      channel:
        typeof (item.content as { channelId?: string })?.channelId === 'string'
          ? (item.content as { channelId?: string }).channelId
          : undefined,
    }))
  } catch {
    return []
  }
}

function describeTrigger(trigger: unknown): string {
  const t = trigger as Record<string, unknown> | null
  if (!t) return 'Immediately'

  const pad = (n: unknown) => String(n).padStart(2, '0')
  const type = String(t.type ?? '')

  /**
   * iOS names its triggers differently: DAILY and WEEKLY both serialise as 'calendar' with
   * the parts inside dateComponents, and a DATE trigger comes back as 'timeInterval'. The
   * screen that exists to tell a scheduling bug from a permission problem was printing
   * nonsense on exactly the platform where you would most need it.
   */
  if (type.includes('calendar')) {
    const parts = t.dateComponents as Record<string, number> | undefined
    if (parts) {
      const at = `${pad(parts.hour ?? 0)}:${pad(parts.minute ?? 0)}`
      if (typeof parts.weekday === 'number') {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        return `Every ${days[parts.weekday - 1] ?? '?'} at ${at}`
      }
      return `Every day at ${at}`
    }
    return 'On a schedule'
  }

  if (type.includes('daily')) return `Every day at ${pad(t.hour)}:${pad(t.minute)}`
  if (type.includes('weekly')) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const weekday = typeof t.weekday === 'number' ? days[t.weekday - 1] : '?'
    return `Every ${weekday} at ${pad(t.hour)}:${pad(t.minute)}`
  }
  if (type.includes('date') || t.value != null) {
    const at = typeof t.value === 'number' ? new Date(t.value) : null
    if (at) {
      const past = at.getTime() < Date.now()
      return `${at.toLocaleString()}${past ? '  ⚠ in the past' : ''}`
    }
  }
  if (type.includes('timeInterval')) return `In ${String(t.seconds)} seconds`
  return type || 'Unknown'
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
