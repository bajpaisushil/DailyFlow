import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { compileReminder, scheduleCost } from './compileReminder.ts'
import type { Checklist, Reminder } from '../types.ts'

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1', title: 'Leave for work', icon: 'work', enabled: true,
    times: ['08:00'], days: [1, 2, 3, 4, 5],
    placeTriggers: [], leadMinutes: [0],
    priority: 'normal', sound: true, vibrate: true,
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
  resetRule: { kind: 'daily' }, createdAt: 0, updatedAt: 0,
}

describe('compileReminder — several times and lead times', () => {
  it('makes one automation per time when there is a single lead', () => {
    const out = compileReminder(reminder({ times: ['08:00', '18:00'] }), [])
    assert.equal(out.length, 2)
  })

  it('multiplies times by lead times, which is the whole point', () => {
    // "warn me 30 minutes before and again 5 minutes before, at 08:00 and 18:00"
    const out = compileReminder(reminder({ times: ['08:00', '18:00'], leadMinutes: [30, 5] }), [])
    assert.equal(out.length, 4)
    const fireTimes = out.map((a) => (a.trigger as { params: { time: string } }).params.time).sort()
    assert.deepEqual(fireTimes, ['07:30', '07:55', '17:30', '17:55'])
  })

  it('subtracts the lead time and wraps backwards past midnight', () => {
    const out = compileReminder(reminder({ times: ['00:10'], leadMinutes: [30] }), [])
    assert.equal((out[0]!.trigger as { params: { time: string } }).params.time, '23:40')
  })

  it('says how long is left in the body, so the notification is self-explanatory', () => {
    const out = compileReminder(reminder({ leadMinutes: [5] }), [])
    const body = (out[0]!.actions[0] as { params: { body?: string } }).params.body
    assert.ok(body?.includes('In 5 minutes'), body ?? 'no body')
  })

  it('uses the singular for a one-minute warning', () => {
    const out = compileReminder(reminder({ leadMinutes: [1] }), [])
    const body = (out[0]!.actions[0] as { params: { body?: string } }).params.body
    assert.ok(body?.includes('In 1 minute.'), body ?? 'no body')
  })

  it('accepts any lead time, not only the preset chips', () => {
    // "notify me 23 minutes before I leave for the temple"
    const out = compileReminder(reminder({ times: ['18:00'], leadMinutes: [23] }), [])
    assert.equal((out[0]!.trigger as { params: { time: string } }).params.time, '17:37')
    const body = (out[0]!.actions[0] as { params: { body?: string } }).params.body
    assert.ok(body?.includes('In 23 minutes'), body ?? 'no body')
  })

  it('deduplicates repeated lead times rather than firing twice', () => {
    const out = compileReminder(reminder({ leadMinutes: [10, 10, 10] }), [])
    assert.equal(out.length, 1)
  })
})

describe('compileReminder — places', () => {
  it('makes one automation per place trigger', () => {
    const out = compileReminder(reminder({
      times: [],
      placeTriggers: [
        { id: 'x', placeId: 'home', on: 'leave' },
        { id: 'y', placeId: 'office', on: 'arrive' },
      ],
    }), [])
    assert.equal(out.length, 2)
    assert.deepEqual(out.map((a) => a.trigger.kind).sort(), ['place.enter', 'place.exit'])
  })

  it('combines times and places on one reminder', () => {
    const out = compileReminder(reminder({
      times: ['08:00'], leadMinutes: [15, 0],
      placeTriggers: [{ id: 'x', placeId: 'home', on: 'leave' }],
    }), [])
    assert.equal(out.length, 3) // two lead times plus one place
  })

  it('gives place triggers a cooldown, so hovering at a boundary cannot spam', () => {
    const out = compileReminder(reminder({
      times: [],
      placeTriggers: [{ id: 'x', placeId: 'home', on: 'leave' }],
    }), [])
    assert.ok((out[0]!.limits?.cooldownMinutes ?? 0) > 0)
  })
})

describe('compileReminder — days and content', () => {
  it('adds a day condition only when it actually restricts anything', () => {
    const everyDay = compileReminder(reminder({ days: [0, 1, 2, 3, 4, 5, 6] }), [])
    assert.equal(everyDay[0]!.conditions.length, 0)

    const weekdays = compileReminder(reminder({ days: [1, 2, 3, 4, 5] }), [])
    assert.equal(weekdays[0]!.conditions.length, 1)
  })

  it('names required list items but never optional ones', () => {
    const out = compileReminder(reminder({ leadMinutes: [0], checklistId: 'c1' }), [bag])
    const body = (out[0]!.actions[0] as { params: { body?: string } }).params.body ?? ''
    assert.ok(body.includes('laptop'))
    assert.ok(!body.includes('umbrella'), 'optional items must not be nagged about')
  })

  it('preserves ids across an edit so firing history survives', () => {
    const first = compileReminder(reminder(), [])
    const second = compileReminder(reminder({ title: 'Changed' }), [], first)
    assert.equal(second[0]!.id, first[0]!.id)
    assert.equal(second[0]!.name, 'Changed')
  })

  it('carries the disabled state onto every generated automation', () => {
    const out = compileReminder(reminder({ enabled: false, times: ['08:00', '09:00'] }), [
      // existing non-empty so the early return does not apply
    ] as never)
    for (const a of out) assert.equal(a.enabled, false)
  })
})

describe('scheduleCost', () => {
  it('counts what the reminder will occupy of the OS budget', () => {
    // 2 times x 2 leads x 5 weekdays = 20 pending notifications.
    assert.equal(scheduleCost(reminder({ times: ['08:00', '18:00'], leadMinutes: [30, 5] })), 20)
    // Every day collapses to a single daily trigger per time/lead pair.
    assert.equal(scheduleCost(reminder({ days: [0, 1, 2, 3, 4, 5, 6], leadMinutes: [0] })), 1)
  })
})
