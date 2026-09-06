import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { courseOccurrences } from './course.ts'
import type { Reminder, Weekday } from './types.ts'

/**
 * A reminder for ONE particular day — Diwali, an interview, a birthday.
 *
 * Everything else in the app repeats, which covers habits. But the reminders that matter most
 * are often the ones that happen once, on a date you must not get wrong, and there was no way
 * to express that: only "every Tuesday" or "for the next 3 days".
 *
 * A single day is startsOn === endsOn. These lock in that this really produces exactly one
 * day's firings and nothing before or after it.
 */

function onDay(date: string, times: string[] = ['09:00']): Pick<
  Reminder, 'times' | 'days' | 'startsOn' | 'endsOn' | 'leadMinutes'
> {
  return {
    times,
    // No weekday restriction: the date IS the restriction, and a weekday filter on top could
    // silently cancel it — a date that falls on a Sunday against a Mon-Fri rule fires never.
    days: [] as Weekday[],
    startsOn: date,
    endsOn: date,
    leadMinutes: [0],
  }
}

// A Monday, well before the dates used below.
const from = new Date(2026, 8, 7, 6, 0)

describe('a reminder on one particular day', () => {
  it('fires once, on that day', () => {
    const out = courseOccurrences(onDay('2026-11-08'), from)
    assert.equal(out.length, 1)
    assert.equal(out[0]?.date, '2026-11-08')
  })

  it('fires at each time that day when several are set', () => {
    const out = courseOccurrences(onDay('2026-11-08', ['06:00', '19:30']), from)
    assert.equal(out.length, 2)
    assert.deepEqual(out.map((o) => o.time), ['06:00', '19:30'])
    assert.ok(out.every((o) => o.date === '2026-11-08'))
  })

  it('produces nothing on any other day', () => {
    const dates = new Set(courseOccurrences(onDay('2026-11-08'), from).map((o) => o.date))
    assert.deepEqual([...dates], ['2026-11-08'])
  })

  it('still works for a date months ahead', () => {
    // The walk is bounded; a date beyond the bound would silently produce no reminder at all.
    const out = courseOccurrences(onDay('2026-12-25'), from, 200)
    assert.equal(out.length, 1)
    assert.equal(out[0]?.date, '2026-12-25')
  })

  it('is ordered, so the soonest firing is first', () => {
    const out = courseOccurrences(onDay('2026-11-08', ['19:30', '06:00']), from)
    assert.ok((out[0]?.at ?? 0) < (out[1]?.at ?? 0))
  })

  it('honours a lead time by firing earlier on the same day', () => {
    const out = courseOccurrences({ ...onDay('2026-11-08', ['09:00']), leadMinutes: [0, 30] }, from)
    assert.equal(out.length, 2)
    // `time` names WHICH configured time an occurrence belongs to; `at` is when it actually
    // fires. The early warning therefore still reads as the 09:00 reminder, fired at 08:30.
    assert.deepEqual(out.map((o) => o.time), ['09:00', '09:00'])
    const clock = out.map((o) => {
      const d = new Date(o.at)
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    })
    assert.deepEqual(clock, ['08:30', '09:00'])
    assert.ok(out.every((o) => o.date === '2026-11-08'), 'a lead must not spill onto another day')
  })
})
