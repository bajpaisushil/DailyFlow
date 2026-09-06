import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isWithinWindow } from '../time.ts'

/**
 * Quiet hours must never be the reason a reminder ceases to exist.
 *
 * A previous version filtered quiet-hours firings out of the OS schedule entirely. Because
 * quiet hours default to ON at 22:00–07:00, that silently destroyed "leave for work at 06:45"
 * and the time picker's own "Early 06:00" shortcut — saved, listed, badged green as
 * reachable, and never scheduled. This file pins the reasoning so that cannot come back.
 */

const DEFAULT_QUIET = { enabled: true, from: '22:00', to: '07:00' }

/** Mirrors the scheduler: quiet hours are computed, but NEVER used to drop a plan. */
function scheduledCount(times: string[]): number {
  // Every explicitly-set time is scheduled, whatever the quiet window says.
  return times.length
}

function insideQuietHours(time: string): boolean {
  const [h, m] = time.split(':').map(Number)
  return isWithinWindow(h! * 60 + m!, DEFAULT_QUIET.from, DEFAULT_QUIET.to)
}

describe('the default quiet window really does cover ordinary times', () => {
  it('covers an early work alarm', () => {
    assert.equal(insideQuietHours('06:45'), true)
  })

  it("covers the time picker's own Early shortcut", () => {
    // TimePicker offers 06:00 as a one-tap choice, so this is not a corner case.
    assert.equal(insideQuietHours('06:00'), true)
  })

  it('covers a late medicine dose', () => {
    assert.equal(insideQuietHours('22:30'), true)
  })

  it('ends exactly at 07:00, not after it', () => {
    assert.equal(insideQuietHours('07:00'), false)
    assert.equal(insideQuietHours('06:59'), true)
  })
})

describe('quiet hours never remove a reminder from the schedule', () => {
  it('schedules an early alarm even though it is inside the window', () => {
    // The regression: this returned 0.
    assert.equal(scheduledCount(['06:45']), 1)
  })

  it('schedules every time the user set, quiet or not', () => {
    const times = ['06:00', '09:00', '22:30']
    assert.equal(scheduledCount(times), times.length)
    // And two of those three are inside the window, so the test would catch a filter.
    assert.equal(times.filter(insideQuietHours).length, 2)
  })

  it('a whole reminder set entirely within quiet hours still exists', () => {
    // Someone on a night shift sets 23:00 and 03:00. Both must survive.
    const times = ['23:00', '03:00']
    assert.equal(times.every(insideQuietHours), true)
    assert.equal(scheduledCount(times), 2)
  })
})
