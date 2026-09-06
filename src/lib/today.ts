import type { Checklist, ChecklistRun, Place, Reminder, Routine } from '@/lib/types'
import { localDateKey, minutesOfDay, parseHHMM, weekdayOf } from '@/lib/time'

/**
 * Builds the Today model — the single most important screen in the app.
 *
 * Today answers three questions, in this order, and nothing else:
 *   1. What is happening now?
 *   2. What is next?
 *   3. What do I need to remember?
 *
 * It is a pure function of the stored data plus the clock, which keeps it trivially
 * testable and means the screen itself holds no logic.
 */

export type DayPhase = 'night' | 'earlyMorning' | 'morning' | 'afternoon' | 'evening'

/**
 * One thing happening today.
 *
 * A reminder and a day plan both land here, because Today answers "what is happening" and the
 * user does not care which internal shape produced it. `source` exists only so tapping a row
 * opens the right editor.
 */
export interface TodayEntry {
  id: string
  title: string
  icon: string
  source: 'reminder' | 'routine'
  /** Present only when this came from a day plan. */
  routine?: Routine
  /** Absolute local time this routine starts today. */
  startsAtMinutes: number
  status: 'past' | 'now' | 'next' | 'later'
  origin?: Place
  destination?: Place
}

export interface TodayChecklist {
  checklist: Checklist
  run: ChecklistRun | null
  remaining: number
  /** Unticked items that are not optional — these are what a reminder names. */
  missing: string[]
  complete: boolean
}

export interface TodayModel {
  phase: DayPhase
  greeting: 'goodMorning' | 'goodAfternoon' | 'goodEvening' | 'goodNight'
  entries: TodayEntry[]
  next: TodayEntry | null
  current: TodayEntry | null
  checklists: TodayChecklist[]
  isFreeDay: boolean
}

export function phaseOf(now: Date): DayPhase {
  const m = minutesOfDay(now)
  if (m < 5 * 60) return 'night'
  if (m < 9 * 60) return 'earlyMorning'
  if (m < 12 * 60) return 'morning'
  if (m < 17 * 60) return 'afternoon'
  if (m < 22 * 60) return 'evening'
  return 'night'
}

function greetingOf(phase: DayPhase): TodayModel['greeting'] {
  switch (phase) {
    case 'earlyMorning':
    case 'morning':
      return 'goodMorning'
    case 'afternoon':
      return 'goodAfternoon'
    case 'evening':
      return 'goodEvening'
    case 'night':
      return 'goodNight'
  }
}

/** A routine counts as "now" from its start until its end, or 90 minutes if it has no end. */
const DEFAULT_WINDOW_MINUTES = 90

export function buildToday(input: {
  now: Date
  routines: Routine[]
  reminders?: Reminder[]
  places: Place[]
  checklists: Checklist[]
  runs: ChecklistRun[]
}): TodayModel {
  const { now, routines, reminders = [], places, checklists, runs } = input
  const today = weekdayOf(now)
  const nowMinutes = minutesOfDay(now)
  const periodKey = localDateKey(now)
  const placeById = new Map(places.map((p) => [p.id, p]))

  const statusFor = (startsAtMinutes: number, finish: number): TodayEntry['status'] =>
    nowMinutes >= startsAtMinutes && nowMinutes < finish
      ? 'now'
      : nowMinutes >= finish
        ? 'past'
        : 'later'

  const fromRoutines: TodayEntry[] = routines
    .filter((r) => r.enabled && r.days.includes(today))
    .map((r) => {
      const startsAtMinutes = parseHHMM(r.startTime) ?? 0
      const endMinutes = r.endTime ? parseHHMM(r.endTime) : null
      return {
        id: r.id,
        title: r.name,
        icon: r.icon,
        source: 'routine' as const,
        routine: r,
        startsAtMinutes,
        status: statusFor(startsAtMinutes, endMinutes ?? startsAtMinutes + DEFAULT_WINDOW_MINUTES),
        origin: r.originPlaceId ? placeById.get(r.originPlaceId) : undefined,
        destination: r.destinationPlaceId ? placeById.get(r.destinationPlaceId) : undefined,
      }
    })

  /**
   * Each of a reminder's times becomes its own row: "take my medicine" at 09:00 and at 21:00
   * are two separate things happening today, and showing them as one would be a lie about the
   * day's shape. A reminder with no times is purely location-driven and cannot be placed on a
   * timeline at all, so it is left off.
   */
  const fromReminders: TodayEntry[] = reminders
    .filter((r) => r.enabled && (r.days.length === 0 || r.days.includes(today)))
    .flatMap((r) =>
      r.times.flatMap((time) => {
        const startsAtMinutes = parseHHMM(time)
        if (startsAtMinutes == null) return []
        return [{
          id: `${r.id}:${time}`,
          title: r.title,
          icon: r.icon,
          source: 'reminder' as const,
          startsAtMinutes,
          status: statusFor(startsAtMinutes, startsAtMinutes + 30),
        }]
      }),
    )

  const entries: TodayEntry[] = [...fromRoutines, ...fromReminders]
    .sort((a, b) => a.startsAtMinutes - b.startsAtMinutes)

  const current = entries.find((e) => e.status === 'now') ?? null

  // The soonest upcoming entry is promoted to "next" so the hero card has something to show.
  const upcoming = entries.find((e) => e.status === 'later') ?? null
  if (upcoming) upcoming.status = 'next'

  // Which lists matter today: those attached to any of today's routines, plus daily-reset lists.
  const attachedIds = new Set([
    ...entries.flatMap((e) => e.routine?.checklistIds ?? []),
    ...reminders.filter((r) => r.enabled && r.checklistId).map((r) => r.checklistId!),
  ])
  const relevant = checklists.filter(
    (c) => attachedIds.has(c.id) || c.resetRule.kind === 'daily',
  )

  const runByChecklist = new Map(
    runs.filter((r) => r.periodKey === periodKey).map((r) => [r.checklistId, r]),
  )

  const todayChecklists: TodayChecklist[] = relevant.map((c) => {
    const run = runByChecklist.get(c.id) ?? null
    const checked = new Set(run?.checkedItemIds ?? [])
    const required = c.items.filter((i) => !i.optional)
    const missing = required.filter((i) => !checked.has(i.id))
    return {
      checklist: c,
      run,
      remaining: c.items.filter((i) => !checked.has(i.id)).length,
      missing: missing.map((i) => i.label),
      complete: missing.length === 0,
    }
  })

  const phase = phaseOf(now)

  return {
    phase,
    greeting: greetingOf(phase),
    entries,
    next: upcoming,
    current,
    checklists: todayChecklists,
    isFreeDay: entries.length === 0,
  }
}

/**
 * How long until something, in words.
 *
 * Kept beside the Today model rather than in the component so the wording is testable and so
 * there is exactly one phrasing of this in the app. Never a bare minute count above an hour:
 * "in 95 minutes" is arithmetic, "in 1 hour 35 min" is not.
 */
export function describeWait(minutesAway: number): string {
  if (minutesAway <= 0) return 'Happening now'
  if (minutesAway < 60) return `in ${minutesAway} minutes`
  const hours = Math.floor(minutesAway / 60)
  const mins = minutesAway % 60
  if (mins === 0) return hours === 1 ? 'in 1 hour' : `in ${hours} hours`
  return hours === 1 ? `in 1 hour ${mins} min` : `in ${hours} hours ${mins} min`
}
