import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { checklistPeriodKey } from './checklistPeriod.ts'
import type { Reminder, Weekday } from './types.ts'

/**
 * Which run of a "take with you" list is the current one.
 *
 * The bug: runs were keyed by DATE, so ticking the list off before the 08:00 school run left
 * it still ticked for the 18:00 one. The user was shown this morning's answer to this
 * evening's question, with no way to ask again until midnight.
 */

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1', title: 'School run', icon: 'bag', enabled: true,
    times: ['08:00', '18:00'], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    checklistId: 'c1',
    priority: 'normal', alertStyle: 'notification', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0, ...over,
  }
}

// A Monday.
const day = (h: number, m = 0) => new Date(2026, 8, 7, h, m)

describe('checklistPeriodKey', () => {
  it('gives the morning and the evening different keys', () => {
    const morning = checklistPeriodKey('c1', [reminder()], day(9))
    const evening = checklistPeriodKey('c1', [reminder()], day(19))
    assert.notEqual(morning, evening)
    assert.equal(morning, '2026-09-07#08:00')
    assert.equal(evening, '2026-09-07#18:00')
  })

  it('holds one key for the whole of an occurrence', () => {
    assert.equal(
      checklistPeriodKey('c1', [reminder()], day(8, 1)),
      checklistPeriodKey('c1', [reminder()], day(17, 59)),
    )
  })

  it('counts the early morning towards the first occurrence, not yesterday', () => {
    // Someone packing a bag at 06:00 for an 08:00 departure is filling in the 08:00 list.
    assert.equal(checklistPeriodKey('c1', [reminder()], day(6)), '2026-09-07#08:00')
  })

  it('keeps the plain date key for a once-a-day list', () => {
    // Existing runs are stored under a bare date. Adding a marker where the answer cannot
    // change during the day would orphan every one of them for no benefit.
    assert.equal(checklistPeriodKey('c1', [reminder({ times: ['08:00'] })], day(9)), '2026-09-07')
  })

  it('keeps the plain date key when nothing is attached', () => {
    assert.equal(checklistPeriodKey('c1', [], day(9)), '2026-09-07')
    assert.equal(checklistPeriodKey('c1', [reminder({ checklistId: 'other' })], day(9)), '2026-09-07')
  })

  it('ignores reminders that do not run today', () => {
    // Sunday-only second time must not split a Monday into two runs.
    const weekly = reminder({ id: 'r2', times: ['18:00'], days: [0] as Weekday[] })
    const daily = reminder({ times: ['08:00'] })
    assert.equal(checklistPeriodKey('c1', [daily, weekly], day(19)), '2026-09-07')
  })

  it('ignores a switched-off reminder', () => {
    const off = reminder({ id: 'r2', times: ['18:00'], enabled: false })
    const on = reminder({ times: ['08:00'] })
    assert.equal(checklistPeriodKey('c1', [on, off], day(19)), '2026-09-07')
  })

  it('combines the times of every reminder sharing the list', () => {
    const a = reminder({ id: 'a', times: ['08:00'] })
    const b = reminder({ id: 'b', times: ['13:00'] })
    assert.equal(checklistPeriodKey('c1', [a, b], day(14)), '2026-09-07#13:00')
  })
})
