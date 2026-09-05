import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compileRoutine, staleAutomationIds } from './compile.ts'
import type { Automation, Checklist, Routine } from '../types.ts'

function routine(over: Partial<Routine> = {}): Routine {
  return {
    id: 'r1', name: 'Work', icon: 'work', enabled: true,
    days: [1, 2, 3, 4, 5], startTime: '07:00',
    checklistIds: [], reminders: {},
    createdAt: 0, updatedAt: 0, ...over,
  }
}

const bag: Checklist = {
  id: 'c1', name: 'Work bag', icon: 'work',
  items: [
    { id: 'i1', label: 'Laptop', order: 0 },
    { id: 'i2', label: 'Charger', order: 1 },
    { id: 'i3', label: 'Umbrella', order: 2, optional: true },
  ],
  resetRule: { kind: 'daily' },
  createdAt: 0, updatedAt: 0,
}

describe('compileRoutine — what a day plan turns into', () => {
  it('produces nothing when no reminders are asked for', () => {
    assert.equal(compileRoutine(routine(), []).length, 0)
  })

  it('creates a departure rule at exactly the start time', () => {
    const out = compileRoutine(routine({ reminders: { atDeparture: true } }), [])
    assert.equal(out.length, 1)
    assert.equal(out[0]!.trigger.kind, 'time.at')
    assert.equal((out[0]!.trigger as { params: { time: string } }).params.time, '07:00')
  })

  it('subtracts the lead time for a checklist nudge', () => {
    const out = compileRoutine(
      routine({ checklistIds: ['c1'], reminders: { checklistNudgeMinutes: 15 } }),
      [bag],
    )
    assert.equal((out[0]!.trigger as { params: { time: string } }).params.time, '06:45')
  })

  it('wraps backwards past midnight rather than producing a negative time', () => {
    const out = compileRoutine(
      routine({ startTime: '00:05', checklistIds: ['c1'], reminders: { checklistNudgeMinutes: 15 } }),
      [bag],
    )
    assert.equal((out[0]!.trigger as { params: { time: string } }).params.time, '23:50')
  })

  it('names required items in the reminder body but not optional ones', () => {
    const out = compileRoutine(
      routine({ checklistIds: ['c1'], reminders: { checklistNudgeMinutes: 15 } }),
      [bag],
    )
    const body = (out[0]!.actions[0] as { params: { body?: string } }).params.body ?? ''
    assert.ok(body.includes('laptop'))
    assert.ok(body.includes('charger'))
    assert.ok(!body.includes('umbrella'), 'optional items must not be nagged about')
  })

  it('carries the routine days onto every generated rule', () => {
    const out = compileRoutine(
      routine({ days: [1, 3], reminders: { atDeparture: true, headsUpMinutes: 30 } }),
      [],
    )
    assert.equal(out.length, 2)
    for (const a of out) {
      const day = a.conditions.find((c) => c.kind === 'day.isOneOf')
      assert.deepEqual((day as { params: { days: number[] } }).params.days, [1, 3])
    }
  })

  it('never creates a location rule without a place, so no rule can silently never fire', () => {
    const withoutPlace = compileRoutine(
      routine({ reminders: { onArriveDestination: true, onLeaveOrigin: true } }),
      [],
    )
    assert.equal(withoutPlace.length, 0)

    const withPlace = compileRoutine(
      routine({
        originPlaceId: 'home', destinationPlaceId: 'office',
        reminders: { onArriveDestination: true, onLeaveOrigin: true },
      }),
      [],
    )
    assert.equal(withPlace.length, 2)
    assert.deepEqual(
      withPlace.map((a) => a.trigger.kind).sort(),
      ['place.enter', 'place.exit'],
    )
  })

  it('generates nothing for a detached routine, which the user now owns by hand', () => {
    const out = compileRoutine(routine({ detached: true, reminders: { atDeparture: true } }), [])
    assert.equal(out.length, 0)
  })

  it('preserves ids across an edit so firing history survives', () => {
    const first = compileRoutine(routine({ reminders: { atDeparture: true } }), [])
    const second = compileRoutine(
      routine({ startTime: '08:00', reminders: { atDeparture: true } }),
      [],
      first,
    )
    assert.equal(second[0]!.id, first[0]!.id)
    assert.equal((second[0]!.trigger as { params: { time: string } }).params.time, '08:00')
  })

  it('inherits the enabled flag, so switching a plan off silences its rules', () => {
    const out = compileRoutine(routine({ enabled: false, reminders: { atDeparture: true } }), [])
    assert.equal(out[0]!.enabled, false)
  })
})

describe('staleAutomationIds', () => {
  it('reports rules the routine no longer implies', () => {
    const existing = compileRoutine(
      routine({ reminders: { atDeparture: true, headsUpMinutes: 30 } }),
      [],
    )
    // The user switches the heads-up off.
    const compiled = compileRoutine(routine({ reminders: { atDeparture: true } }), [], existing)
    const stale = staleAutomationIds(compiled, existing)
    assert.equal(stale.length, 1)
    assert.ok(!compiled.map((a) => a.id).includes(stale[0]!))
  })

  it('reports nothing when the rule set is unchanged', () => {
    const existing: Automation[] = compileRoutine(
      routine({ reminders: { atDeparture: true } }),
      [],
    )
    const compiled = compileRoutine(routine({ reminders: { atDeparture: true } }), [], existing)
    assert.deepEqual(staleAutomationIds(compiled, existing), [])
  })
})
