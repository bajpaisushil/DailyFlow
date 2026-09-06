import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { describeRepeat, isDated, nextDates } from './repeat.ts'
import { alarmOccurrences } from './notify/alarmOccurrences.ts'
import { buildToday } from './today.ts'
import { compileReminder } from './engine/compileReminder.ts'
import { planFor } from './notify/plan.ts'
import type { Reminder, Weekday } from './types.ts'

/**
 * How often a reminder comes back.
 *
 * The clamping rules are the whole risk here, and both are silent data loss when wrong: a rent
 * reminder on the 31st must still arrive in February, and a 29 February birthday must not go
 * quiet for three years at a time.
 */

const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 9, 0)

describe('nextDates — yearly', () => {
  it('returns this year when the date is still ahead', () => {
    assert.deepEqual(
      nextDates('yearly', '2026-11-08', on(2026, 9, 7), 2),
      ['2026-11-08', '2027-11-08'],
    )
  })

  it('skips to next year once the date has passed', () => {
    assert.deepEqual(nextDates('yearly', '2026-11-08', on(2026, 12, 1), 1), ['2027-11-08'])
  })

  it('is still due this year for an anniversary set years ago', () => {
    // Walking forward from the anchor's own year would spend every slot on dates long gone,
    // and the reminder would appear to have no next occurrence at all.
    assert.deepEqual(nextDates('yearly', '2019-11-08', on(2026, 9, 7), 1), ['2026-11-08'])
  })

  it('includes the date when it is exactly today', () => {
    assert.equal(nextDates('yearly', '2026-11-08', on(2026, 11, 8), 1)[0], '2026-11-08')
  })

  it('falls back to 28 February for a 29 February anniversary', () => {
    // 2027, 2028, 2029 — only 2028 is a leap year.
    assert.deepEqual(
      nextDates('yearly', '2024-02-29', on(2027, 1, 1), 3),
      ['2027-02-28', '2028-02-29', '2029-02-28'],
    )
  })
})

describe('nextDates — monthly', () => {
  it('returns this month when the day is still ahead', () => {
    assert.deepEqual(
      nextDates('monthly', '2026-09-20', on(2026, 9, 7), 2),
      ['2026-09-20', '2026-10-20'],
    )
  })

  it('moves to next month once the day has passed', () => {
    assert.deepEqual(nextDates('monthly', '2026-09-05', on(2026, 9, 7), 1), ['2026-10-05'])
  })

  it('clamps the 31st to the last day of a short month', () => {
    // A rent reminder set for the 31st must still arrive in February and in 30-day months.
    assert.deepEqual(
      nextDates('monthly', '2026-01-31', on(2026, 1, 1), 4),
      ['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30'],
    )
  })

  it('rolls over the year boundary', () => {
    assert.deepEqual(
      nextDates('monthly', '2026-12-15', on(2026, 12, 20), 2),
      ['2027-01-15', '2027-02-15'],
    )
  })
})

describe('nextDates — once', () => {
  it('returns the single date when it is ahead', () => {
    assert.deepEqual(nextDates('once', '2026-11-08', on(2026, 9, 7)), ['2026-11-08'])
  })

  it('returns nothing once it has gone', () => {
    // A one-off in the past must produce no firing, not fire immediately.
    assert.deepEqual(nextDates('once', '2026-09-01', on(2026, 9, 7)), [])
  })

  it('still fires on the day itself', () => {
    assert.deepEqual(nextDates('once', '2026-09-07', on(2026, 9, 7)), ['2026-09-07'])
  })
})

describe('nextDates — edges', () => {
  it('produces nothing for the weekly model, which uses weekdays', () => {
    assert.deepEqual(nextDates('weekly', '2026-11-08', on(2026, 9, 7)), [])
  })

  it('rejects a malformed date rather than inventing one', () => {
    for (const bad of ['', 'tomorrow', '2026-13-01', '2026-11-40', '26-11-08']) {
      assert.deepEqual(nextDates('yearly', bad, on(2026, 9, 7)), [], bad)
    }
  })

  it('returns exactly as many dates as asked for', () => {
    assert.equal(nextDates('yearly', '2026-11-08', on(2026, 9, 7), 5).length, 5)
    assert.equal(nextDates('monthly', '2026-09-20', on(2026, 9, 7), 6).length, 6)
  })
})

describe('isDated', () => {
  it('separates the date-driven kinds from the weekday one', () => {
    assert.equal(isDated('once'), true)
    assert.equal(isDated('monthly'), true)
    assert.equal(isDated('yearly'), true)
    assert.equal(isDated('weekly'), false)
    assert.equal(isDated(undefined), false)
  })
})

describe('describeRepeat', () => {
  it('reads back in the words the picker used', () => {
    assert.equal(describeRepeat('once'), 'Once, then never again')
    assert.equal(describeRepeat('yearly'), 'Every year')
    assert.equal(describeRepeat('monthly'), 'Every month')
    assert.equal(describeRepeat(undefined), 'Every week')
  })
})

/**
 * A dated repeat has to reach the parts of the app that actually make a noise.
 *
 * The date maths above being right is worth nothing if a yearly reminder never becomes a
 * scheduled firing — which is exactly what happened before, because both the alarm layout and
 * the notification planner walked WEEKDAYS over a two-week horizon and had no notion of a date
 * months or years away.
 */
describe('dated repeats reach the schedule', () => {
  const base = {
    id: 'r1', title: 'Diwali', icon: 'sparkle', enabled: true,
    times: ['08:00'], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    priority: 'normal' as const, alertStyle: 'alarm' as const, sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0,
  }

  it('arms alarms for a yearly reminder years out', () => {
    const out = alarmOccurrences(
      { ...base, repeat: 'yearly', onDate: '2026-11-08' },
      on(2026, 9, 7),
    )
    assert.ok(out.length > 0, 'a yearly alarm must actually be armed')
    assert.equal(new Date(out[0]!).getMonth(), 10)
    assert.equal(new Date(out[0]!).getDate(), 8)
  })

  it('arms nothing for a one-off whose day has gone', () => {
    assert.deepEqual(
      alarmOccurrences({ ...base, repeat: 'once', onDate: '2026-09-01' }, on(2026, 9, 7)),
      [],
    )
  })

  it('leaves the weekly model alone', () => {
    // Existing reminders carry no `repeat` at all and must behave exactly as before.
    // Six, not seven, over a seven-day horizon: it is already 09:00, so today's 08:00 has
    // gone. Arming a moment in the past would fire it immediately.
    const weekly = alarmOccurrences({ ...base, times: ['08:00'] }, on(2026, 9, 7), 7)
    assert.equal(weekly.length, 6)
  })
})

/**
 * A dated repeat must not colonise the Today screen.
 *
 * Yearly and monthly reminders carry no weekday restriction and no end date, so the weekly
 * test — "no days set means every day" — was satisfied every single day of the year. Diwali
 * would have sat on Today for twelve months, which destroys the one thing that screen is for.
 */
describe('dated repeats on the Today screen', () => {
  const diwali: Reminder = {
    id: 'd1', title: 'Diwali', icon: 'sparkle', enabled: true,
    times: ['08:00'], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    repeat: 'yearly', onDate: '2026-11-08',
    priority: 'normal', alertStyle: 'alarm', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0,
  }

  const todayFor = (d: Date) =>
    buildToday({ now: d, routines: [], reminders: [diwali], places: [], checklists: [], runs: [] })

  it('appears on the day itself', () => {
    assert.equal(todayFor(on(2026, 11, 8)).entries.length, 1)
  })

  it('appears on no other day of the year', () => {
    for (const [m, d] of [[9, 7], [11, 7], [11, 9], [12, 25], [1, 1]] as const) {
      const year = m === 1 ? 2027 : 2026
      assert.equal(todayFor(on(year, m, d)).entries.length, 0, `${year}-${m}-${d}`)
    }
  })

  it('comes back the following year', () => {
    assert.equal(todayFor(on(2027, 11, 8)).entries.length, 1)
  })
})

/**
 * The whole point: a dated repeat must produce firings ONLY on its dates.
 *
 * 362 tests passed while a yearly reminder compiled to a firing every single day for four
 * months. Everything was tested in isolation — nextDates was right, courseOccurrences was
 * right — but planFor silently dropped `window.dates` on the way between them, so the range
 * walk ran instead: no start date, no weekday restriction, every day. The lesson is that the
 * seam between two correct functions is where this class of bug lives, so these tests go
 * through the REAL compile-and-plan path rather than any single function.
 */
describe('a dated repeat fires only on its dates', () => {
  const yearly: Reminder = {
    id: 'y1', title: 'Diwali', icon: 'sparkle', enabled: true,
    times: ['08:00'], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    repeat: 'yearly', onDate: '2026-11-08',
    priority: 'normal', alertStyle: 'notification', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0,
  }

  const plansFor = (r: Reminder, at: Date) =>
    compileReminder(r, []).flatMap((a) => planFor(a, at))

  it('produces one firing per date, not one per day', () => {
    const plans = plansFor(yearly, on(2026, 9, 7))
    assert.ok(plans.length > 0, 'a yearly reminder must produce firings at all')
    // Four look-ahead years. Before the fix this was 120 — every day of the range walk.
    assert.ok(plans.length <= 4, `expected at most 4 firings, got ${plans.length}`)
  })

  it('lands every firing on the 8th of November', () => {
    for (const plan of plansFor(yearly, on(2026, 9, 7))) {
      assert.equal(plan.when.every, 'once', 'a dated repeat must never be a repeating rule')
      const d = new Date((plan.when as { at: number }).at)
      assert.equal(d.getMonth(), 10, `fired in month ${d.getMonth() + 1}`)
      assert.equal(d.getDate(), 8, `fired on day ${d.getDate()}`)
    }
  })

  it('never compiles to a daily or weekly rule', () => {
    // The failure mode was silent: `every: 'day'` looks perfectly healthy in the schedule.
    for (const plan of plansFor(yearly, on(2026, 9, 7))) {
      assert.notEqual(plan.when.every, 'day')
      assert.notEqual(plan.when.every, 'week')
    }
  })

  it('produces NOTHING rather than a daily rule when the date is missing', () => {
    // A yearly reminder saved before a date was picked used to become "every day, forever".
    const noDate = { ...yearly, onDate: undefined }
    assert.deepEqual(plansFor(noDate, on(2026, 9, 7)), [])
  })

  it('produces NOTHING for a one-off whose day has passed', () => {
    const gone: Reminder = { ...yearly, repeat: 'once', onDate: '2026-09-01' }
    assert.deepEqual(plansFor(gone, on(2026, 9, 7)), [])
  })

  it('still lets an ordinary weekly reminder repeat', () => {
    const weekly: Reminder = { ...yearly, repeat: 'weekly', onDate: undefined, days: [] }
    const plans = plansFor(weekly, on(2026, 9, 7))
    assert.ok(plans.some((p) => p.when.every === 'day'), 'a daily habit must stay a daily rule')
  })
})
