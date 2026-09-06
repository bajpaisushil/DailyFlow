import type { Automation, Checklist, LocalDate, Reminder, Weekday } from '@/lib/types'
import { isDated, nextDates } from '@/lib/repeat'
import { newId } from '@/lib/id'
import { parseHHMM, toHHMM } from '@/lib/time'

/**
 * A Reminder compiles into Automations.
 *
 * This is what lets one thing the user created carry SEVERAL times and SEVERAL places:
 * each (time × lead-time) pair and each place trigger becomes its own automation, and the
 * engine keeps exactly one evaluation path. The user never sees any of it.
 *
 * Slots are deterministic, so editing a reminder updates its automations in place rather
 * than orphaning them — which matters because the firing ledger is keyed by automation id,
 * and losing it would let an already-delivered reminder fire a second time.
 */

/** "in 5 minutes" style wording for the lead-time notification. */
function leadLine(reminder: Reminder, leadMinutes: number): string | undefined {
  if (leadMinutes <= 0) return reminder.message
  const unit = leadMinutes === 1 ? 'minute' : 'minutes'
  const head = `In ${leadMinutes} ${unit}.`
  return reminder.message ? `${head} ${reminder.message}` : head
}

/** Names a few things from the attached list, so the reminder is useful rather than generic. */
function checklistLine(reminder: Reminder, checklists: Checklist[]): string | undefined {
  if (!reminder.checklistId) return undefined
  const list = checklists.find((c) => c.id === reminder.checklistId)
  if (!list) return undefined
  const required = list.items.filter((i) => !i.optional).slice(0, 3).map((i) => i.label.toLowerCase())
  if (required.length === 0) return undefined
  return `Take your ${required.join(', ')}.`
}

/**
 * Which style a particular firing uses.
 *
 * With `both`, the lead-time warnings stay quiet messages and only the firing at the real
 * moment rings — a warning half an hour ahead that blares is a warning people switch off.
 */
function styleForFiring(reminder: Reminder, leadMinutes: number): 'notification' | 'alarm' {
  if (reminder.alertStyle === 'alarm') return 'alarm'
  if (reminder.alertStyle === 'both') return leadMinutes <= 0 ? 'alarm' : 'notification'
  return 'notification'
}

export function compileReminder(
  reminder: Reminder,
  checklists: Checklist[],
  existing: Automation[] = [],
): Automation[] {
  if (!reminder.enabled && existing.length === 0) return []

  const bySlot = new Map(existing.map((a) => [a.sourceSlot, a]))
  const now = Date.now()
  // A Date as well as a stamp: dated repeats need to know which occurrences are still ahead.
  const today = new Date(now)
  const out: Automation[] = []
  const listLine = checklistLine(reminder, checklists)

  const make = (slot: string, partial: Omit<Automation, 'id' | 'createdAt' | 'updatedAt' | 'sourceSlot' | 'enabled' | 'icon'>) => {
    const prior = bySlot.get(slot)
    out.push({
      id: prior?.id ?? newId(),
      createdAt: prior?.createdAt ?? now,
      updatedAt: now,
      sourceReminderId: reminder.id,
      sourceSlot: slot,
      enabled: reminder.enabled,
      icon: reminder.icon,
      ...partial,
    } as Automation)
  }

  const restrictsDays = reminder.days.length > 0 && reminder.days.length < 7
  const dayCondition = restrictsDays
    ? [{ kind: 'day.isOneOf' as const, params: { days: reminder.days } }]
    : []

  /**
   * Days for a firing that landed on the PREVIOUS calendar day.
   *
   * "Remind me at 00:10 on Monday, 30 minutes before" fires at 23:40 — which is SUNDAY. Left
   * with Monday's day condition it was scheduled for Monday 23:40, so the user got no warning
   * before the Monday reminder and an unexplained one nearly a day late. Every day has to
   * shift back one when the lead time crosses midnight.
   */
  const shiftedDays = (days: Weekday[]): Weekday[] =>
    days.map((d) => (((d - 1) % 7) + 7) % 7 as Weekday).sort((a, b) => a - b)

  // One automation per time × lead-time. Lead times are deduplicated and sorted so the
  // earliest warning is created first and the set is stable across edits.
  const leads = [...new Set(reminder.leadMinutes.length ? reminder.leadMinutes : [0])].sort((a, b) => b - a)

  for (const time of reminder.times) {
    const base = parseHHMM(time)
    if (base == null) continue

    for (const lead of leads) {
      const raw = base - lead
      const crossedMidnight = raw < 0
      const fireAt = toHHMM(raw)

      // A warning that lands before midnight belongs to the day BEFORE the reminder's day.
      const conditionsForFiring = restrictsDays
        ? [{
            kind: 'day.isOneOf' as const,
            params: { days: crossedMidnight ? shiftedDays(reminder.days) : reminder.days },
          }]
        : []

      make(`t:${time}:${lead}`, {
        name: reminder.title,
        trigger: { kind: 'time.at', params: { time: fireAt } },
        conditions: conditionsForFiring,
        match: 'all',
        // A bounded reminder carries its window through, so the scheduler can lay out dated
        // occurrences that expire rather than a rule that repeats forever.
        window: windowFor(reminder, today),
        actions: [{
          kind: 'notify',
          params: {
            title: reminder.title,
            body: leadLine(reminder, lead) ?? listLine,
            priority: reminder.priority,
            includeChecklistId: reminder.checklistId,
            vibrate: reminder.vibrate,
            alertStyle: styleForFiring(reminder, lead),
            // Both were saved on the Reminder and read by nothing, so the toggles in the
            // editor did exactly nothing.
            silent: !reminder.sound,
            toneId: reminder.toneId,
          },
        }],
        limits: { maxPerDay: 1 },
      })
    }
  }

  // One automation per place trigger. These carry a cooldown because a phone sitting near a
  // boundary can otherwise cross it repeatedly.
  for (const pt of reminder.placeTriggers) {
    make(`p:${pt.placeId}:${pt.on}`, {
      name: reminder.title,
      trigger: {
        kind: pt.on === 'arrive' ? 'place.enter' : 'place.exit',
        params: { placeId: pt.placeId },
      },
      conditions: dayCondition,
      match: 'all',
      // A course that ends must end completely. Without this the clock reminders stopped on
      // schedule while "remind me when I get home" kept firing forever.
      window: windowFor(reminder, today),
      actions: [{
        kind: 'notify',
        params: {
          title: reminder.title,
          body: reminder.message ?? listLine,
          priority: reminder.priority,
          includeChecklistId: reminder.checklistId,
          vibrate: reminder.vibrate,
          // A place trigger has no lead-time concept, so it uses the reminder's own style.
          alertStyle: reminder.alertStyle === 'notification' ? 'notification' : 'alarm',
          silent: !reminder.sound,
          toneId: reminder.soundFile ?? reminder.toneId,
          alarmDurationSeconds: reminder.alarmDurationSeconds,
        },
      }],
      limits: { cooldownMinutes: 30, maxPerDay: 3 },
    })
  }

  return out
}

/** Automations the reminder no longer implies, so the caller can remove them. */
export function staleReminderAutomationIds(compiled: Automation[], existing: Automation[]): string[] {
  const keep = new Set(compiled.map((a) => a.id))
  return existing.filter((a) => !keep.has(a.id)).map((a) => a.id)
}

/** How many OS schedules this reminder will occupy, for the pending-notification budget. */
export function scheduleCost(reminder: Reminder): number {
  const leads = new Set(reminder.leadMinutes.length ? reminder.leadMinutes : [0]).size
  const perTime = reminder.days.length === 0 || reminder.days.length === 7 ? 1 : reminder.days.length
  return reminder.times.length * leads * perTime
}

/**
 * The dates a reminder should be laid out on, if it is not a plain weekly one.
 *
 * A monthly or yearly reminder cannot be a repeating clock rule: the OS understands "every
 * day" and "every weekday", and nothing longer. So the next few occurrences are computed here
 * and scheduled as individual dated firings, refreshed on every app start — which is also what
 * makes them survive a year of not being touched.
 *
 * `LOOK_AHEAD` is small on purpose. Four occurrences is four years for a birthday and four
 * months for rent; the schedule is rebuilt every time the app opens, so a bigger number buys
 * nothing but pending-notification budget.
 */
const LOOK_AHEAD = 4

function windowFor(
  reminder: Reminder,
  now: Date,
): { from?: LocalDate; until: LocalDate; dates?: LocalDate[] } | undefined {
  if (isDated(reminder.repeat) && reminder.onDate) {
    const dates = nextDates(reminder.repeat!, reminder.onDate, now, LOOK_AHEAD)
    if (dates.length === 0) return undefined
    return { dates, until: dates[dates.length - 1]! }
  }

  return reminder.endsOn ? { from: reminder.startsOn, until: reminder.endsOn } : undefined
}
