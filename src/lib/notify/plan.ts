import type { Automation, NotificationPriority, Weekday } from '@/lib/types'
import { parseHHMM } from '@/lib/time'

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

export interface ScheduledPlan {
  /** Stable identifier, so a plan can be reasoned about without an OS handle. */
  key: string
  automationId: string
  title: string
  body?: string
  priority: NotificationPriority
  when: TriggerPlan
}

/**
 * Turn one automation into the concrete schedules it needs. Returns an empty array when the
 * automation cannot be expressed as a fixed clock time — location and state triggers are
 * handled by the geofence and the in-app engine instead.
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
    title: notify.params.title,
    body: notify.params.body,
    priority: notify.params.priority,
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
