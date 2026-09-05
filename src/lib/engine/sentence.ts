import type { Action, Automation, Checklist, Condition, Place, Trigger } from '@/lib/types'
import { describeDays, formatTime } from '@/lib/time'
import { S } from '@/lib/strings'

/**
 * Renders a rule as a plain sentence.
 *
 * Every rule the app builds must be readable as ordinary language — "Every work day at
 * 6:45, if you are at Home, show your Work bag list" — because the moment a rule reads like
 * configuration, we have lost the audience this product is for.
 *
 * The vocabulary is fixed by lib/strings.ts: When / Only if / Then. The words "trigger",
 * "condition" and "action" never reach the screen.
 */

export interface NameLookup {
  places: Map<string, Place>
  checklists: Map<string, Checklist>
  routines: Map<string, string>
}

export function buildLookup(input: {
  places: Place[]
  checklists: Checklist[]
  routines: Array<{ id: string; name: string }>
}): NameLookup {
  return {
    places: new Map(input.places.map((p) => [p.id, p])),
    checklists: new Map(input.checklists.map((c) => [c.id, c])),
    routines: new Map(input.routines.map((r) => [r.id, r.name])),
  }
}

const placeName = (l: NameLookup, id: string) => l.places.get(id)?.name ?? 'a place'
const listName = (l: NameLookup, id: string) => l.checklists.get(id)?.name ?? 'a list'

export function describeTrigger(
  trigger: Trigger,
  l: NameLookup,
  opts: { use24h: boolean; locale: string },
): string {
  switch (trigger.kind) {
    case 'time.at':
      return `at ${formatTime(trigger.params.time, opts.use24h, opts.locale)}`
    case 'time.beforeRoutine':
      return `${trigger.params.minutesBefore} minutes before ${l.routines.get(trigger.params.routineId) ?? 'your plan'}`
    case 'place.enter':
      return `you get to ${placeName(l, trigger.params.placeId)}`
    case 'place.exit':
      return `you leave ${placeName(l, trigger.params.placeId)}`
    case 'place.dwell':
      return `you stay at ${placeName(l, trigger.params.placeId)} a while`
    case 'routine.start':
      return `${l.routines.get(trigger.params.routineId) ?? 'your plan'} starts`
    case 'routine.end':
      return `${l.routines.get(trigger.params.routineId) ?? 'your plan'} ends`
    case 'checklist.unfinished':
      return `${listName(l, trigger.params.checklistId)} is not ticked by ${formatTime(trigger.params.atTime, opts.use24h, opts.locale)}`
    case 'battery.below':
      return `your battery falls below ${trigger.params.percent} out of 100`
    case 'app.opened':
      return 'you open DailyFlow'
    case 'day.started':
      return 'a new day starts'
    case 'mode.on':
      return `${trigger.params.mode} starts`
    case 'mode.off':
      return `${trigger.params.mode} ends`
  }
}

export function describeCondition(
  condition: Condition,
  l: NameLookup,
  opts: { use24h: boolean; locale: string },
): string {
  const not = condition.negate
  switch (condition.kind) {
    case 'day.isOneOf':
      return `it is ${describeDays(condition.params.days, opts.locale).toLowerCase()}`
    case 'time.between':
      return `the time is between ${formatTime(condition.params.from, opts.use24h, opts.locale)} and ${formatTime(condition.params.to, opts.use24h, opts.locale)}`
    case 'place.currentlyAt':
      return `you are ${not ? 'not ' : ''}at ${placeName(l, condition.params.placeId)}`
    case 'checklist.isComplete':
      return `${listName(l, condition.params.checklistId)} is ${not ? 'not ' : ''}ticked`
    case 'routine.isActive':
      return `${l.routines.get(condition.params.routineId) ?? 'your plan'} is ${not ? 'not ' : ''}on`
    case 'mode.isOn':
      return `${condition.params.mode} is ${not ? 'off' : 'on'}`
    case 'battery.below':
      return `your battery is below ${condition.params.percent} out of 100`
    case 'network.isOffline':
      return not ? 'you have internet' : 'you have no internet'
  }
}

export function describeAction(action: Action, l: NameLookup): string {
  switch (action.kind) {
    case 'notify':
      return `tell you “${action.params.title}”`
    case 'checklist.show':
      return `show ${listName(l, action.params.checklistId)}`
    case 'checklist.reset':
      return `clear the ticks on ${listName(l, action.params.checklistId)}`
    case 'mode.turnOn':
      return `turn on ${action.params.mode}`
    case 'mode.turnOff':
      return `turn off ${action.params.mode}`
    case 'commute.start':
      return 'start On the way'
    case 'commute.end':
      return 'finish On the way'
    case 'speak':
      return `say “${action.params.text}”`
    case 'openUrl':
      return `open ${action.params.label ?? 'an app'}`
    case 'log':
      return 'make a note'
  }
}

/** The whole rule as one readable line. */
export function describeAutomation(
  automation: Automation,
  l: NameLookup,
  opts: { use24h: boolean; locale: string },
): string {
  const when = describeTrigger(automation.trigger, l, opts)
  const joiner = automation.match === 'any' ? ' or ' : ' and '
  const conditions = automation.conditions.map((c) => describeCondition(c, l, opts)).join(joiner)
  const actions = automation.actions.map((a) => describeAction(a, l)).join(joiner)

  const head = `When ${when}`
  const middle = conditions ? `, and ${conditions}` : ''
  return `${head}${middle}, DailyFlow will ${actions}.`
}

/** The three chips the builder shows: When / Only if / Then. */
export function describeParts(
  automation: Automation,
  l: NameLookup,
  opts: { use24h: boolean; locale: string },
): { when: string; onlyIf: string[]; then: string[] } {
  return {
    when: describeTrigger(automation.trigger, l, opts),
    onlyIf: automation.conditions.map((c) => describeCondition(c, l, opts)),
    then: automation.actions.map((a) => describeAction(a, l)),
  }
}

export const LABELS = {
  when: S.reminder.when,
  onlyIf: S.reminder.onlyIf,
  then: S.reminder.then,
} as const
