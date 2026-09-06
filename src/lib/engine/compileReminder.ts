import type { Automation, Checklist, Reminder } from '@/lib/types'
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

export function compileReminder(
  reminder: Reminder,
  checklists: Checklist[],
  existing: Automation[] = [],
): Automation[] {
  if (!reminder.enabled && existing.length === 0) return []

  const bySlot = new Map(existing.map((a) => [a.sourceSlot, a]))
  const now = Date.now()
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

  const dayCondition =
    reminder.days.length > 0 && reminder.days.length < 7
      ? [{ kind: 'day.isOneOf' as const, params: { days: reminder.days } }]
      : []

  // One automation per time × lead-time. Lead times are deduplicated and sorted so the
  // earliest warning is created first and the set is stable across edits.
  const leads = [...new Set(reminder.leadMinutes.length ? reminder.leadMinutes : [0])].sort((a, b) => b - a)

  for (const time of reminder.times) {
    const base = parseHHMM(time)
    if (base == null) continue

    for (const lead of leads) {
      const fireAt = toHHMM(base - lead)
      make(`t:${time}:${lead}`, {
        name: reminder.title,
        trigger: { kind: 'time.at', params: { time: fireAt } },
        conditions: dayCondition,
        match: 'all',
        actions: [{
          kind: 'notify',
          params: {
            title: reminder.title,
            body: leadLine(reminder, lead) ?? listLine,
            priority: reminder.priority,
            includeChecklistId: reminder.checklistId,
            vibrate: reminder.vibrate,
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
      actions: [{
        kind: 'notify',
        params: {
          title: reminder.title,
          body: reminder.message ?? listLine,
          priority: reminder.priority,
          includeChecklistId: reminder.checklistId,
          vibrate: reminder.vibrate,
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
