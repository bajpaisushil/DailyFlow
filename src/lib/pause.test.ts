import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearedIfLapsed, datesAfterPause, describePause, isActive, isPaused,
  pauseForDays, skipTodayUntil,
} from './pause.ts'
import { alarmOccurrences } from './notify/alarmOccurrences.ts'
import { compileReminder } from './engine/compileReminder.ts'
import { planFor } from './notify/plan.ts'
import { localDateKey } from './time.ts'
import type { Reminder, Weekday } from './types.ts'

/**
 * Pausing without deleting.
 *
 * The boundary is the whole risk: a pause that ends a day early fires when the user said not
 * to, and one that ends a day late silently costs them a reminder they were expecting back.
 */

// A Monday.
const on = (d: number, h = 9) => new Date(2026, 8, d, h, 0)

describe('isPaused', () => {
  const paused = { pausedUntil: '2026-09-09' }

  it('is quiet on the day the pause ends', () => {
    // Inclusive: "paused until Wednesday" means Wednesday is quiet too.
    assert.equal(isPaused(paused, on(9)), true)
  })

  it('is back the very next day', () => {
    assert.equal(isPaused(paused, on(10)), false)
  })

  it('is quiet on every day in between', () => {
    for (const d of [7, 8, 9]) assert.equal(isPaused(paused, on(d)), true, `day ${d}`)
  })

  it('is not paused at all without a date', () => {
    assert.equal(isPaused({}, on(7)), false)
    assert.equal(isPaused({ pausedUntil: undefined }, on(7)), false)
  })

  it('is unaffected by the time of day', () => {
    // Late at night on the last paused day is still paused.
    assert.equal(isPaused(paused, on(9, 23)), true)
    assert.equal(isPaused(paused, on(10, 0)), false)
  })
})

describe('isActive', () => {
  it('needs both switched on AND not paused', () => {
    assert.equal(isActive({ enabled: true, pausedUntil: undefined }, on(7)), true)
    assert.equal(isActive({ enabled: false, pausedUntil: undefined }, on(7)), false)
    assert.equal(isActive({ enabled: true, pausedUntil: '2026-09-09' }, on(7)), false)
    // Switched off AND paused is still just off.
    assert.equal(isActive({ enabled: false, pausedUntil: '2026-09-09' }, on(20)), false)
  })
})

describe('choosing a pause', () => {
  it('skip today is quiet today and back tomorrow', () => {
    const until = skipTodayUntil(on(7))
    assert.equal(until, '2026-09-07')
    assert.equal(isPaused({ pausedUntil: until }, on(7)), true)
    assert.equal(isPaused({ pausedUntil: until }, on(8)), false)
  })

  it('one day is the same as skipping today', () => {
    assert.equal(pauseForDays(1, on(7)), skipTodayUntil(on(7)))
  })

  it('a week covers seven days and returns on the eighth', () => {
    const until = pauseForDays(7, on(7))
    assert.equal(until, '2026-09-13')
    assert.equal(isPaused({ pausedUntil: until }, on(13)), true)
    assert.equal(isPaused({ pausedUntil: until }, on(14)), false)
  })

  it('never produces a pause that is already over', () => {
    for (const n of [0, -1, -100]) {
      assert.equal(isPaused({ pausedUntil: pauseForDays(n, on(7)) }, on(7)), true, `${n}`)
    }
  })
})

describe('clearedIfLapsed', () => {
  it('keeps a pause that is still running', () => {
    assert.equal(clearedIfLapsed('2026-09-09', on(8)), '2026-09-09')
  })

  it('drops one that has passed, so nothing offers to resume it', () => {
    assert.equal(clearedIfLapsed('2026-09-09', on(10)), undefined)
  })
})

describe('describePause', () => {
  it('says Off rather than paused when it is switched off', () => {
    assert.equal(describePause({ enabled: false }, on(7)), 'Off')
  })

  it('says nothing at all when it is running normally', () => {
    assert.equal(describePause({ enabled: true }, on(7)), null)
  })

  it('names today specially, because "until today" reads as a mistake', () => {
    assert.equal(describePause({ enabled: true, pausedUntil: '2026-09-07' }, on(7)), 'Skipped today')
  })

  it('reports the day it comes BACK, not the last quiet day', () => {
    // "Paused until Wednesday" is ambiguous about Wednesday; the day it returns is not.
    const said = describePause({ enabled: true, pausedUntil: '2026-09-09' }, on(7), 'en-GB')
    assert.match(said ?? '', /10 September/)
  })
})

describe('datesAfterPause', () => {
  const days = [] as Weekday[]

  it('lists only days after the pause ends', () => {
    const out = datesAfterPause({ pausedUntil: '2026-09-09', days }, on(7), 5)
    assert.deepEqual(out, ['2026-09-10', '2026-09-11'])
  })

  it('respects which weekdays the reminder runs on', () => {
    // Mondays only. 2026-09-07 is a Monday, so the next is the 14th.
    const out = datesAfterPause({ pausedUntil: '2026-09-09', days: [1] as Weekday[] }, on(7), 14)
    assert.deepEqual(out, ['2026-09-14'])
  })

  it('is empty when nothing is paused, so a normal reminder keeps its repeating rule', () => {
    assert.deepEqual(datesAfterPause({ pausedUntil: undefined, days }, on(7), 7), [])
  })

  it('never includes the last paused day itself', () => {
    const out = datesAfterPause({ pausedUntil: '2026-09-09', days }, on(7), 10)
    assert.ok(!out.includes('2026-09-09'))
  })
})

/**
 * A pause has to reach the PHONE, not just the screen.
 *
 * Writing `pausedUntil` into the database alone would leave every already-scheduled
 * notification and every armed alarm exactly where it was — the reminder would look paused in
 * the app and go off anyway, which is the worst of both. These go through the real compile and
 * alarm-layout paths.
 */
describe('a paused reminder reaches nothing', () => {
  const base: Reminder = {
    id: 'p1', title: 'Morning pills', icon: 'pills', enabled: true,
    times: ['08:00'], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    priority: 'normal', alertStyle: 'alarm', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0,
  }

  it('arms no alarm inside the pause', () => {
    const paused = { ...base, pausedUntil: '2026-09-09' }
    for (const at of alarmOccurrences(paused, on(7, 6))) {
      assert.ok(localDateKey(new Date(at)) > '2026-09-09', `armed ${new Date(at).toISOString()}`)
    }
  })

  it('still arms alarms once the pause is over', () => {
    const paused = { ...base, pausedUntil: '2026-09-09' }
    assert.ok(alarmOccurrences(paused, on(7, 6), 14).length > 0, 'it must come back by itself')
  })

  it('arms nothing at all while switched off', () => {
    assert.deepEqual(alarmOccurrences({ ...base, enabled: false }, on(7, 6)), [])
  })

  it('never leaves a repeating rule in place during a pause', () => {
    /**
     * The trap. "Every day at 8" is one repeating OS trigger and a single day of it cannot be
     * cancelled — so a paused daily reminder must not be compiled as a repeating rule at all,
     * or the OS fires straight through the pause while the app shows it as paused.
     */
    const paused = { ...base, alertStyle: 'notification' as const, pausedUntil: '2026-09-09' }
    const plans = compileReminder(paused, [], [], on(7, 6)).flatMap((a) => planFor(a, on(7, 6)))
    assert.ok(plans.length > 0, 'it must still be scheduled for after the pause')
    for (const plan of plans) {
      assert.equal(plan.when.every, 'once', 'a repeating rule would fire during the pause')
      const at = new Date((plan.when as { at: number }).at)
      assert.ok(localDateKey(at) > '2026-09-09', `scheduled ${localDateKey(at)}, inside the pause`)
    }
  })

  it('goes back to a plain repeating rule once nothing is paused', () => {
    const plans = compileReminder({ ...base, alertStyle: 'notification' }, [], [], on(7, 6))
      .flatMap((a) => planFor(a, on(7, 6)))
    assert.ok(plans.some((p) => p.when.every === 'day'), 'a daily habit should stay a daily rule')
  })
})
