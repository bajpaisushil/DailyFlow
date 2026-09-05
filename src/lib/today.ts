import type { Checklist, ChecklistRun, Place, Routine } from '@/lib/types'
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

export interface TodayEntry {
  routine: Routine
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
  places: Place[]
  checklists: Checklist[]
  runs: ChecklistRun[]
}): TodayModel {
  const { now, routines, places, checklists, runs } = input
  const today = weekdayOf(now)
  const nowMinutes = minutesOfDay(now)
  const periodKey = localDateKey(now)
  const placeById = new Map(places.map((p) => [p.id, p]))

  const entries: TodayEntry[] = routines
    .filter((r) => r.enabled && r.days.includes(today))
    .map((r) => {
      const startsAtMinutes = parseHHMM(r.startTime) ?? 0
      const endMinutes = r.endTime ? parseHHMM(r.endTime) : null
      const finish = endMinutes ?? startsAtMinutes + DEFAULT_WINDOW_MINUTES
      const status: TodayEntry['status'] =
        nowMinutes >= startsAtMinutes && nowMinutes < finish
          ? 'now'
          : nowMinutes >= finish
            ? 'past'
            : 'later'
      return {
        routine: r,
        startsAtMinutes,
        status,
        origin: r.originPlaceId ? placeById.get(r.originPlaceId) : undefined,
        destination: r.destinationPlaceId ? placeById.get(r.destinationPlaceId) : undefined,
      }
    })
    .sort((a, b) => a.startsAtMinutes - b.startsAtMinutes)

  const current = entries.find((e) => e.status === 'now') ?? null

  // The soonest upcoming entry is promoted to "next" so the hero card has something to show.
  const upcoming = entries.find((e) => e.status === 'later') ?? null
  if (upcoming) upcoming.status = 'next'

  // Which lists matter today: those attached to any of today's routines, plus daily-reset lists.
  const attachedIds = new Set(entries.flatMap((e) => e.routine.checklistIds))
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
