import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildToday, describeWait, phaseOf } from './today.ts'
import type { Checklist, ChecklistRun, Place, Reminder, Routine, Weekday } from './types.ts'

/** Minimal fixtures — only the fields buildToday actually reads. */
const now = (h: number, m = 0) => new Date(2026, 8, 7, h, m) // 2026-09-07 is a Monday

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: 'r1', name: 'Work', icon: 'work', enabled: true,
    days: [1, 2, 3, 4, 5], startTime: '07:00',
    checklistIds: [], reminders: {},
    createdAt: 0, updatedAt: 0, ...over,
  }
}

function checklist(over: Partial<Checklist> = {}): Checklist {
  return {
    id: 'c1', name: 'Work bag', icon: 'work',
    items: [
      { id: 'i1', label: 'Laptop', order: 0 },
      { id: 'i2', label: 'Umbrella', order: 1, optional: true },
    ],
    resetRule: { kind: 'daily' },
    createdAt: 0, updatedAt: 0, ...over,
  }
}

const build = (o: {
  now: Date; routines?: Routine[]; places?: Place[]
  checklists?: Checklist[]; runs?: ChecklistRun[]
}) => buildToday({
  now: o.now, routines: o.routines ?? [], places: o.places ?? [],
  checklists: o.checklists ?? [], runs: o.runs ?? [],
})

describe('phaseOf', () => {
  it('maps the clock onto the parts of a day', () => {
    assert.equal(phaseOf(now(2)), 'night')
    assert.equal(phaseOf(now(7)), 'earlyMorning')
    assert.equal(phaseOf(now(10)), 'morning')
    assert.equal(phaseOf(now(14)), 'afternoon')
    assert.equal(phaseOf(now(19)), 'evening')
    assert.equal(phaseOf(now(23)), 'night')
  })
})

describe('buildToday — what is happening', () => {
  it('shows a routine as "now" inside its window and "past" after it', () => {
    const r = [routine({ startTime: '07:00', endTime: '09:00' })]
    assert.equal(build({ now: now(8), routines: r }).current?.id, 'r1')
    assert.equal(build({ now: now(10), routines: r }).entries[0]!.status, 'past')
  })

  it('promotes the soonest upcoming routine to "next"', () => {
    const r = [
      routine({ id: 'a', name: 'Gym', startTime: '18:00' }),
      routine({ id: 'b', name: 'Work', startTime: '09:00' }),
    ]
    const model = build({ now: now(7), routines: r })
    assert.equal(model.next?.id, 'b')
    assert.equal(model.entries[0]!.id, 'b') // sorted by time
  })

  it('ignores routines that do not run today', () => {
    // 2026-09-07 is a Monday; a weekend-only routine must not appear.
    const model = build({ now: now(9), routines: [routine({ days: [0, 6] })] })
    assert.equal(model.entries.length, 0)
    assert.equal(model.isFreeDay, true)
  })

  it('ignores disabled routines', () => {
    const model = build({ now: now(9), routines: [routine({ enabled: false })] })
    assert.equal(model.isFreeDay, true)
  })
})

describe('buildToday — reminders on the timeline', () => {
  const reminder = (over: Partial<Reminder> = {}): Reminder => ({
    id: 'rem1', title: 'Take my medicine', icon: 'pills', enabled: true,
    times: ['09:00'], days: [1, 2, 3, 4, 5] as Weekday[], placeTriggers: [], leadMinutes: [0],
    priority: 'normal', alertStyle: 'notification', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0, ...over,
  })

  it('shows a reminder alongside day plans', () => {
    const model = buildToday({
      now: now(7), routines: [], reminders: [reminder()],
      places: [], checklists: [], runs: [],
    })
    assert.equal(model.entries.length, 1)
    assert.equal(model.entries[0]!.title, 'Take my medicine')
    assert.equal(model.entries[0]!.source, 'reminder')
  })

  it('gives each of a reminder\'s times its own row', () => {
    // 09:00 and 21:00 are two separate things happening today.
    const model = buildToday({
      now: now(7), routines: [], reminders: [reminder({ times: ['09:00', '21:00'] })],
      places: [], checklists: [], runs: [],
    })
    assert.equal(model.entries.length, 2)
  })

  it('leaves a purely location-based reminder off the timeline', () => {
    // It has no time, so it cannot honestly be placed on a clock.
    const model = buildToday({
      now: now(7), routines: [],
      reminders: [reminder({ times: [], placeTriggers: [{ id: 'x', placeId: 'home', on: 'leave' }] })],
      places: [], checklists: [], runs: [],
    })
    assert.equal(model.entries.length, 0)
  })

  it('sorts reminders and day plans together by time', () => {
    const model = buildToday({
      now: now(6),
      routines: [routine({ id: 'plan', name: 'Work', startTime: '08:00' })],
      reminders: [reminder({ times: ['07:00'] })],
      places: [], checklists: [], runs: [],
    })
    assert.equal(model.entries[0]!.source, 'reminder')
    assert.equal(model.entries[1]!.source, 'routine')
  })
})

describe('buildToday — what to remember', () => {
  it('counts only non-optional items as missing', () => {
    const model = build({ now: now(6), checklists: [checklist()] })
    const entry = model.checklists[0]!
    assert.deepEqual(entry.missing, ['Laptop'])
    assert.equal(entry.complete, false)
    assert.equal(entry.remaining, 2) // both untick ed, optional included in the raw count
  })

  it('is complete once every required item is ticked, even if an optional one is not', () => {
    const runs: ChecklistRun[] = [{
      id: 'run1', checklistId: 'c1', periodKey: '2026-09-07',
      checkedItemIds: ['i1'], startedAt: 0,
    }]
    const entry = build({ now: now(6), checklists: [checklist()], runs }).checklists[0]!
    assert.equal(entry.complete, true)
    assert.deepEqual(entry.missing, [])
  })

  it('ignores a run from a different day, so ticks reset overnight', () => {
    const runs: ChecklistRun[] = [{
      id: 'run1', checklistId: 'c1', periodKey: '2026-09-06',
      checkedItemIds: ['i1'], startedAt: 0,
    }]
    const entry = build({ now: now(6), checklists: [checklist()], runs }).checklists[0]!
    assert.equal(entry.complete, false)
    assert.deepEqual(entry.missing, ['Laptop'])
  })

  it('includes a list attached to a routine even when it does not reset daily', () => {
    const list = checklist({ id: 'gym', resetRule: { kind: 'onRoutineStart' } })
    const model = build({
      now: now(6),
      routines: [routine({ checklistIds: ['gym'] })],
      checklists: [list],
    })
    assert.equal(model.checklists.some((c) => c.checklist.id === 'gym'), true)
  })
})

describe('describeWait', () => {
  it('never makes the reader do arithmetic', () => {
    assert.equal(describeWait(0), 'Happening now')
    assert.equal(describeWait(-5), 'Happening now')
    assert.equal(describeWait(1), 'in 1 minutes')
    assert.equal(describeWait(40), 'in 40 minutes')
  })

  it('switches to hours rather than printing 95 minutes', () => {
    assert.equal(describeWait(60), 'in 1 hour')
    assert.equal(describeWait(95), 'in 1 hour 35 min')
    assert.equal(describeWait(120), 'in 2 hours')
    assert.equal(describeWait(150), 'in 2 hours 30 min')
  })
})
