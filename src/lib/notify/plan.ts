import type { Automation, NotificationPriority, Weekday } from '@/lib/types'
import { parseHHMM } from '@/lib/time'
import { courseOccurrences } from '@/lib/course'

/**
 * The scheduling maths, deliberately free of both React Native and expo-notifications.
 *
 * Keeping this pure means the part most worth testing — how a rule becomes a set of clock
 * schedules, and how many of them it costs against the platform's pending budget — can be
 * verified without a native runtime. `scheduler.ts` translates these descriptors into the
 * OS's own trigger objects.
 */

/** iOS keeps at most 64 pending local notifications; we stay clear of the ceiling. */
export const MAX_PENDING = 56

/** A platform-agnostic description of when a reminder should fire. */
export type TriggerPlan =
  | { every: 'day'; hour: number; minute: number }
  | { every: 'week'; weekday: Weekday; hour: number; minute: number }
  /** A single dated occurrence, used for reminders that run for a fixed period. */
  | { every: 'once'; at: number }

export interface ScheduledPlan {
  /** Stable identifier, so a plan can be reasoned about without an OS handle. */
  key: string
  automationId: string
  /**
   * Which reminder this came from, when it came from one. Needed so the scheduler can skip
   * firings the native sound path has already claimed.
   */
  sourceReminderId?: string
  title: string
  body?: string
  priority: NotificationPriority
  /** 'alarm' routes to the loud channel that can wake someone. */
  alertStyle?: 'notification' | 'alarm'
  silent?: boolean
  toneId?: string
  when: TriggerPlan
}

/**
 * Turn one automation into the concrete schedules it needs. Returns an empty array when the
 * automation cannot be expressed as a fixed clock time — location and state triggers are
 * handled by the geofence and the in-app engine instead.
 */
export function planFor(automation: Automation, now = new Date()): ScheduledPlan[] {
  if (!automation.enabled) return []
  if (automation.trigger.kind !== 'time.at') return []

  const notify = automation.actions.find((a) => a.kind === 'notify')
  if (!notify || notify.kind !== 'notify') return []

  const minutes = parseHHMM(automation.trigger.params.time)
  if (minutes == null) return []

  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60

  /**
   * Day restriction comes from a day condition. A NEGATED set is deliberately treated as
   * "every day" rather than scheduled as its complement: the OS schedule is only a coarse
   * gate, and the in-app engine applies the real condition before anything is shown. Firing
   * the complement here would surface reminders on the very days the user excluded.
   */
  const dayCondition = automation.conditions.find((c) => c.kind === 'day.isOneOf')
  const days: Weekday[] =
    dayCondition && dayCondition.kind === 'day.isOneOf' && !dayCondition.negate
      ? dayCondition.params.days
      : [0, 1, 2, 3, 4, 5, 6]

  if (days.length === 0) return []

  const base = {
    automationId: automation.id,
    sourceReminderId: automation.sourceReminderId,
    title: notify.params.title,
    body: notify.params.body,
    priority: notify.params.priority,
    alertStyle: notify.params.alertStyle,
    silent: notify.params.silent,
    toneId: notify.params.toneId,
  }

  /**
   * A bounded rule becomes one dated notification per occurrence, so it stops on its own.
   * A repeating DAILY/WEEKLY trigger would outlive the course and keep firing after the
   * medicine ran out, which is precisely how people learn to ignore reminders.
   */
  if (automation.window) {
    const occurrences = courseOccurrences(
      {
        times: [automation.trigger.params.time],
        days,
        startsOn: automation.window.from,
        endsOn: automation.window.until,
        /**
         * Without this the dated branch is never taken, and a monthly or yearly reminder falls
         * into the RANGE walk instead: no `from`, so it starts today, no weekday restriction,
         * and it fires every single day up to the walk's limit. Diwali every day for four
         * months. The dates are the whole instruction.
         */
        dates: automation.window.dates,
        leadMinutes: [0],
      },
      now,
    )
    return occurrences.map((o, i) => ({
      ...base,
      key: `${automation.id}:once:${i}`,
      when: { every: 'once' as const, at: o.at },
    }))
  }

  // Seven days collapses to one daily trigger — a 7x saving against the pending budget.
  if (days.length === 7) {
    return [{ ...base, key: `${automation.id}:daily`, when: { every: 'day', hour, minute } }]
  }

  return days.map((day) => ({
    ...base,
    key: `${automation.id}:w${day}`,
    when: { every: 'week', weekday: day, hour, minute },
  }))
}

/**
 * Drop the firings a native path has taken over.
 *
 * Pure and separate so the rule can be tested without a native runtime: the cost of getting
 * it wrong is a reminder that either arrives twice or does not arrive at all, and neither is
 * something to discover on a user's phone.
 */
export function withoutClaimedReminders(
  plans: ScheduledPlan[],
  claimedReminderIds: Iterable<string>,
): ScheduledPlan[] {
  const claimed = new Set(claimedReminderIds)
  if (claimed.size === 0) return plans
  return plans.filter((p) => !(p.sourceReminderId && claimed.has(p.sourceReminderId)))
}
