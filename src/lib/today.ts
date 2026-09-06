import type {
  ActivityEvent, Checklist, ChecklistRun, HHMM, Place, Reminder, Routine, Weekday,
} from '@/lib/types'
import { checklistPeriodKey } from '@/lib/checklistPeriod'
import { alreadyThere, currentPlace, type Presence } from '@/lib/presence'
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
  /**
   * The user is already at the place this entry was about going to.
   *
   * Today used to keep saying "leave for temple" while the user was standing in it — the app
   * failing at the one thing it exists for, which is knowing what is happening now.
   */
  arrived?: boolean
  /** Absolute local time this routine starts today. */
  startsAtMinutes: number
  status: 'past' | 'now' | 'next' | 'later'
  /**
   * Minutes since this was due. 0 while it is still ahead.
   *
   * Exists because "Now" was shown for the WHOLE window an entry stayed relevant — thirty
   * minutes for a reminder, ninety for a routine. Ten minutes after a reminder was due the
   * screen still insisted it was happening now, which is simply false, and it is the one
   * number on this screen a person checks against their own sense of the time.
   */
  minutesLate: number
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
  /** Where the user is, when the app knows. Drives what Today says rather than assumes. */
  presence: Presence | null
  phase: DayPhase
  greeting: 'goodMorning' | 'goodAfternoon' | 'goodEvening' | 'goodNight'
  entries: TodayEntry[]
  next: TodayEntry | null
  current: TodayEntry | null
  checklists: TodayChecklist[]
  isFreeDay: boolean
}

/**
 * Does this reminder have anything to do with today?
 *
 * A purely location-based reminder counts: you could reach the place at any moment, so the
 * list it carries is worth having to hand.
 */
function isRelevantToday(
  reminder: { days: Weekday[]; times: HHMM[]; placeTriggers: unknown[] },
  today: Weekday,
): boolean {
  if (reminder.placeTriggers.length > 0) return true
  if (reminder.times.length === 0) return false
  return reminder.days.length === 0 || reminder.days.includes(today)
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
  /** Arrivals and departures already recorded by the geofence. */
  activity?: ActivityEvent[]
}): TodayModel {
  const { now, routines, reminders = [], places, checklists, runs, activity = [] } = input
  const presence = currentPlace(activity, places, now.getTime())
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

  /** How long ago this was due. Never negative: something upcoming is not late. */
  const lateBy = (startsAtMinutes: number): number =>
    Math.max(0, nowMinutes - startsAtMinutes)

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
        minutesLate: lateBy(startsAtMinutes),
        origin: r.originPlaceId ? placeById.get(r.originPlaceId) : undefined,
        destination: r.destinationPlaceId ? placeById.get(r.destinationPlaceId) : undefined,
        arrived: alreadyThere(presence, r.destinationPlaceId),
      }
    })

  /**
   * Each of a reminder's times becomes its own row: "take my medicine" at 09:00 and at 21:00
   * are two separate things happening today, and showing them as one would be a lie about the
   * day's shape. A reminder with no times is purely location-driven and cannot be placed on a
   * timeline at all, so it is left off.
   */
  /**
   * Is a bounded reminder running today?
   *
   * Without this a course of antibiotics finished a month ago still appeared on the home
   * screen as the next thing happening — the reminder had correctly stopped firing, so the
   * screen was contradicting the notifications.
   */
  const withinCourse = (r: Reminder): boolean => {
    if (r.startsOn && periodKey < r.startsOn) return false
    if (r.endsOn && periodKey > r.endsOn) return false
    return true
  }

  const fromReminders: TodayEntry[] = reminders
    .filter((r) => r.enabled && withinCourse(r) && (r.days.length === 0 || r.days.includes(today)))
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
          minutesLate: lateBy(startsAtMinutes),
        }]
      }),
    )

  const entries: TodayEntry[] = [...fromRoutines, ...fromReminders]
    .sort((a, b) => a.startsAtMinutes - b.startsAtMinutes)

  const current = entries.find((e) => e.status === 'now') ?? null

  /**
   * "Next" skips anything the user has already arrived at.
   *
   * Otherwise the hero card urges someone to set off for a place they are standing in, which
   * reads as the app not knowing where they are — and it does know.
   */
  const upcoming = entries.find((e) => e.status === 'later' && !e.arrived) ?? null
  if (upcoming) upcoming.status = 'next'

  /**
   * A list belongs on Today only because something happening today needs it.
   *
   * This used to also include every list whose ticks reset daily, which was wrong: reset
   * frequency describes how a list behaves, not whether it is relevant now. The effect was
   * that the three starter lists filled the home screen from first launch, so a new user's
   * Today was a wall of packing lists for trips they had not planned — and the reminders they
   * had actually created were pushed underneath.
   */
  const attachedIds = new Set([
    ...entries.flatMap((e) => e.routine?.checklistIds ?? []),
    ...reminders
      .filter((r) => r.enabled && r.checklistId && withinCourse(r) && isRelevantToday(r, today))
      .map((r) => r.checklistId!),
  ])
  const relevant = checklists.filter((c) => attachedIds.has(c.id))

  /**
   * A run belongs to an OCCURRENCE, not to a day. Matching on the date alone showed the
   * morning's ticks against the evening's reminder — the list looked packed when it was not.
   */
  const runByChecklist = new Map(
    relevant
      .map((c) => {
        const key = checklistPeriodKey(c.id, reminders, now)
        const run = runs.find((r) => r.checklistId === c.id && r.periodKey === key)
        return run ? ([c.id, run] as const) : null
      })
      .filter((e): e is readonly [string, ChecklistRun] => e !== null),
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
    presence,
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
