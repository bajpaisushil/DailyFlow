import type { Automation, Checklist, Routine } from '@/lib/types'
import { newId } from '@/lib/id'
import { toHHMM, parseHHMM } from '@/lib/time'
import { S } from '@/lib/strings'

/**
 * Routines compile into automations.
 *
 * This is the central architectural decision of the app (see the header of lib/types.ts).
 * A Routine is sugar: the user answers a few friendly questions, and we generate the
 * TRIGGER -> CONDITIONS -> ACTIONS rules that the engine and the OS scheduler actually run.
 *
 * Consequences, all of them wanted:
 *  - One evaluation path. There is no separate "routine engine" to keep in sync.
 *  - Beginners never see a rule; advanced users can open a routine's generated rules and,
 *    by detaching, take permanent ownership of them. That is our progressive disclosure.
 *  - New reminder styles are new slots here, not new concepts elsewhere.
 *
 * Regeneration is keyed by `sourceSlot`, so editing a routine updates its rules in place
 * and never orphans or duplicates them.
 */

type Slot = 'headsUp' | 'checklistNudge' | 'departure' | 'leftOrigin' | 'arrived'

function baseAutomation(routine: Routine, slot: Slot, existing?: Automation): Pick<
  Automation,
  'id' | 'createdAt' | 'sourceRoutineId' | 'sourceSlot' | 'enabled' | 'icon'
> {
  return {
    id: existing?.id ?? newId(),
    createdAt: existing?.createdAt ?? Date.now(),
    sourceRoutineId: routine.id,
    sourceSlot: slot,
    enabled: routine.enabled,
    icon: routine.icon,
  }
}

/** Names the things still unticked, so the reminder is useful rather than generic. */
function checklistSummary(routine: Routine, checklists: Checklist[]): string | undefined {
  const attached = checklists.filter((c) => routine.checklistIds.includes(c.id))
  if (attached.length === 0) return undefined
  const important = attached
    .flatMap((c) => c.items)
    .filter((i) => !i.optional)
    .slice(0, 3)
    .map((i) => i.label.toLowerCase())
  if (important.length === 0) return undefined
  return `Take your ${important.join(', ')}.`
}

/**
 * Produce the full set of automations a routine implies.
 * `existing` lets us preserve ids (and therefore firing history) across an edit.
 */
export function compileRoutine(
  routine: Routine,
  checklists: Checklist[],
  existing: Automation[] = [],
): Automation[] {
  if (routine.detached) return []

  const bySlot = new Map(existing.map((a) => [a.sourceSlot, a]))
  const out: Automation[] = []
  const now = Date.now()
  const startMinutes = parseHHMM(routine.startTime)
  if (startMinutes == null) return []

  const dayCondition = {
    kind: 'day.isOneOf' as const,
    params: { days: routine.days },
  }

  const push = (slot: Slot, partial: Omit<Automation, keyof ReturnType<typeof baseAutomation> | 'updatedAt'>) => {
    out.push({
      ...baseAutomation(routine, slot, bySlot.get(slot)),
      ...partial,
      updatedAt: now,
    } as Automation)
  }

  const checklistLine = checklistSummary(routine, checklists)
  const firstChecklistId = routine.checklistIds[0]

  // "Office day today" — a calm heads-up well before departure.
  if (routine.reminders.headsUpMinutes != null) {
    push('headsUp', {
      name: `${routine.name} — heads up`,
      trigger: {
        kind: 'time.at',
        params: { time: toHHMM(startMinutes - routine.reminders.headsUpMinutes) },
      },
      conditions: [dayCondition],
      match: 'all',
      actions: [{
        kind: 'notify',
        params: {
          title: `${routine.name} today`,
          body: routine.destinationPlaceId ? undefined : checklistLine,
          priority: 'quiet',
        },
      }],
    })
  }

  // "Leaving soon. Take your laptop, charger, wallet."
  if (routine.reminders.checklistNudgeMinutes != null && routine.checklistIds.length > 0) {
    push('checklistNudge', {
      name: `${routine.name} — things to take`,
      trigger: {
        kind: 'time.at',
        params: { time: toHHMM(startMinutes - routine.reminders.checklistNudgeMinutes) },
      },
      conditions: [dayCondition],
      match: 'all',
      actions: [{
        kind: 'notify',
        params: {
          title: S.today.takeWithYou,
          body: checklistLine,
          priority: 'normal',
          includeChecklistId: firstChecklistId,
        },
      }],
      limits: { maxPerDay: 1 },
    })
  }

  // "Time to leave."
  if (routine.reminders.atDeparture) {
    push('departure', {
      name: `${routine.name} — time to go`,
      trigger: { kind: 'time.at', params: { time: routine.startTime } },
      conditions: [dayCondition],
      match: 'all',
      actions: [{
        kind: 'notify',
        params: { title: routine.name, body: 'Time to go.', priority: 'normal' },
      }],
      limits: { maxPerDay: 1 },
    })
  }

  // Location-driven slots. Only generated when a place is actually attached, so we never
  // create a rule that could not possibly fire.
  if (routine.reminders.onLeaveOrigin && routine.originPlaceId) {
    push('leftOrigin', {
      name: `${routine.name} — leaving`,
      trigger: { kind: 'place.exit', params: { placeId: routine.originPlaceId } },
      conditions: [dayCondition],
      match: 'all',
      actions: [{
        kind: 'notify',
        params: {
          title: 'Have you got everything?',
          body: checklistLine,
          priority: 'normal',
          includeChecklistId: firstChecklistId,
        },
      }],
      limits: { cooldownMinutes: 60, maxPerDay: 1 },
    })
  }

  if (routine.reminders.onArriveDestination && routine.destinationPlaceId) {
    push('arrived', {
      name: `${routine.name} — arrived`,
      trigger: { kind: 'place.enter', params: { placeId: routine.destinationPlaceId } },
      conditions: [dayCondition],
      match: 'all',
      actions: [{
        kind: 'notify',
        params: { title: `You are at ${routine.name}`, priority: 'quiet' },
      }],
      limits: { cooldownMinutes: 60, maxPerDay: 1 },
    })
  }

  return out
}

/**
 * Which previously-generated automations are no longer implied by the routine and must go.
 * Returned rather than deleted here so the caller owns all persistence.
 */
export function staleAutomationIds(compiled: Automation[], existing: Automation[]): string[] {
  const keep = new Set(compiled.map((a) => a.id))
  return existing.filter((a) => !keep.has(a.id)).map((a) => a.id)
}
