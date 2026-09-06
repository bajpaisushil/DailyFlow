import type {
  Automation, AppSettings, Checklist, ChecklistRun, NotificationPriority, Reminder,
} from '@/lib/types'
import { isWithinWindow, localDateKey, minutesOfDay } from '@/lib/time'
import { checklistPeriodKey } from '@/lib/checklistPeriod'
import { activity, automations, firings } from '@/lib/db/repo'

/**
 * Notification governance (REQUIREMENTS.md #31).
 *
 * A reminder app that nags is worse than no reminder app, so every firing passes through
 * this pipeline in order. The first rule that says no wins, and the reason is recorded so
 * the user can later see *why* something stayed quiet — visible in "What happened".
 *
 * Order matters and is deliberate:
 *   1. Already fired for this occurrence?      (idempotence — never show the same thing twice)
 *   2. Rule switched off?
 *   3. Checklist already done?                 (nothing to remind about)
 *   4. Per-rule cooldown / daily cap
 *   5. Quiet hours                             (importance can override, if the user allows)
 *   6. Global hourly / daily ceiling           (lowest priority is dropped first)
 */

export type Decision =
  | { allow: true }
  | { allow: false; reason: string }

export interface GovernanceInput {
  automation: Automation
  occurrenceKey: string
  priority: NotificationPriority
  now: Date
  settings: AppSettings
  checklists: Checklist[]
  runs: ChecklistRun[]
  /**
   * The reminders in play, so a checklist's CURRENT run can be identified. A list attached to
   * a twice-daily reminder has two runs a day; without these, the evening firing would be
   * suppressed by the morning's ticks.
   */
  reminders?: Reminder[]
}

/**
 * How close together two firings of the SAME reminder are treated as one.
 *
 * Long enough that a time trigger and an arrival minutes apart do not both shout; short enough
 * that a genuine second dose hours later still arrives.
 */
export const SAME_REMINDER_COOLDOWN_MS = 30 * 60 * 1000

/**
 * When this reminder last actually reached the user, by any of its triggers.
 * Returns null if it never has.
 */
function mostRecentFiringForReminder(reminderId: string, now: Date): number | null {
  const automationIds = new Set(
    automations
      .all()
      .filter((a) => a.sourceReminderId === reminderId)
      .map((a) => a.id),
  )
  if (automationIds.size === 0) return null

  let latest: number | null = null
  for (const firing of firings.recent()) {
    if (firing.outcome !== 'fired') continue
    if (!automationIds.has(firing.automationId)) continue
    if (firing.firedAt > now.getTime()) continue
    if (latest == null || firing.firedAt > latest) latest = firing.firedAt
  }
  return latest
}

/** Deterministic key: one row per intended occurrence, stable across restarts. */
export function dedupeKey(automationId: string, occurrenceKey: string): string {
  return `${automationId}:${occurrenceKey}`
}

export function decide(input: GovernanceInput): Decision {
  const {
    automation, occurrenceKey, priority, now, settings, checklists, runs, reminders = [],
  } = input

  // 1. Idempotence. A ledger row — whatever its outcome — blocks a repeat.
  if (firings.has(dedupeKey(automation.id, occurrenceKey))) {
    return { allow: false, reason: 'Already reminded you about this.' }
  }

  // 2. Switched off.
  if (!automation.enabled) {
    return { allow: false, reason: 'This reminder is off.' }
  }

  // 3. Nothing left to remind about.
  if (settings.notifications.suppressWhenChecklistDone) {
    const notify = automation.actions.find((a) => a.kind === 'notify')
    const listId = notify?.kind === 'notify' ? notify.params.includeChecklistId : undefined
    if (listId && isChecklistDone(listId, checklists, runs, now, reminders)) {
      return { allow: false, reason: 'You already ticked everything.' }
    }
  }

  /**
   * 3b. The same REMINDER already reached the user by another route.
   *
   * A reminder can carry both a time and a place — "take my medicine at 9, and remind me when
   * I get home in case I forgot" — and those compile to separate automations with separate
   * dedup keys. Walking in at 9:05 therefore produced TWO notifications for one thing, which
   * is exactly the nagging the governance pipeline exists to prevent. The reminder is the
   * unit the user thinks in, so it is the unit that gets the cooldown.
   */
  if (automation.sourceReminderId) {
    const siblingFiredAt = mostRecentFiringForReminder(automation.sourceReminderId, now)
    if (siblingFiredAt != null && now.getTime() - siblingFiredAt < SAME_REMINDER_COOLDOWN_MS) {
      return { allow: false, reason: 'You have just been told about this.' }
    }
  }

  // 4. Per-rule limits.
  const history = firings.forAutomation(automation.id).filter((f) => f.outcome === 'fired')

  const cooldown = automation.limits?.cooldownMinutes
  if (cooldown != null) {
    const last = history[0]
    if (last && now.getTime() - last.firedAt < cooldown * 60_000) {
      return { allow: false, reason: 'Reminded you about this a moment ago.' }
    }
  }

  const maxPerDay = automation.limits?.maxPerDay
  if (maxPerDay != null) {
    const today = localDateKey(now)
    const firedToday = history.filter((f) => localDateKey(new Date(f.firedAt)) === today).length
    if (firedToday >= maxPerDay) {
      return { allow: false, reason: 'Already reminded you enough today.' }
    }
  }

  // 5. Quiet hours. "Important" may pass only if the user allowed it.
  const quiet = settings.notifications.quietHours
  if (quiet.enabled && isWithinWindow(minutesOfDay(now), quiet.from, quiet.to)) {
    const mayPass = priority === 'important' && quiet.allowImportant
    if (!mayPass) {
      return { allow: false, reason: 'You asked not to be woken now.' }
    }
  }

  // 6. Global ceilings. Quiet reminders are dropped before normal ones.
  const all = allFiredWithin(now.getTime() - 3_600_000)
  if (all.hour >= settings.notifications.maxPerHour && priority !== 'important') {
    return { allow: false, reason: 'That is enough reminders for one hour.' }
  }
  if (all.day >= settings.notifications.maxPerDay && priority !== 'important') {
    return { allow: false, reason: 'That is enough reminders for one day.' }
  }

  return { allow: true }
}

function isChecklistDone(
  checklistId: string,
  checklists: Checklist[],
  runs: ChecklistRun[],
  now: Date,
  /** Needed to know WHICH run of the list is current — a twice-daily list has two a day. */
  reminders: Reminder[],
): boolean {
  const list = checklists.find((c) => c.id === checklistId)
  if (!list) return false
  const run = runs.find(
    (r) => r.checklistId === checklistId && r.periodKey === checklistPeriodKey(checklistId, reminders, now),
  )
  if (!run) return false
  const checked = new Set(run.checkedItemIds)
  return list.items.filter((i) => !i.optional).every((i) => checked.has(i.id))
}

function allFiredWithin(since: number): { hour: number; day: number } {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  let hour = 0
  let day = 0
  for (const f of firings.recent()) {
    if (f.outcome !== 'fired') continue
    if (f.firedAt >= since) hour += 1
    if (f.firedAt >= dayStart.getTime()) day += 1
  }
  return { hour, day }
}

/**
 * Record the outcome. Always called — a blocked firing still writes a row, both so it can
 * never fire late and so the user can see the reason in "What happened".
 */
export function record(
  automation: Automation,
  occurrenceKey: string,
  decision: Decision,
  summary: string,
): void {
  const key = dedupeKey(automation.id, occurrenceKey)
  firings.record({
    key,
    automationId: automation.id,
    occurrenceKey,
    firedAt: Date.now(),
    outcome: decision.allow ? 'fired' : 'suppressed',
    reason: decision.allow ? undefined : decision.reason,
  })

  activity.add({
    kind: decision.allow ? 'automation.fired' : 'automation.suppressed',
    summary,
    automationId: automation.id,
    reason: decision.allow ? undefined : decision.reason,
  })
}
