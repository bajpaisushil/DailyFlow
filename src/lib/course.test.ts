import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { courseOccurrences, describeCourse, endDateAfterDays, occurrenceCount } from './course.ts'
import type { Weekday } from './types.ts'

/** A course of medicine: three times a day, for one week. */
const course = (over: Record<string, unknown> = {}) => ({
  times: ['09:00', '14:00', '21:00'],
  days: [0, 1, 2, 3, 4, 5, 6] as Weekday[],
  leadMinutes: [0],
  startsOn: '2026-09-07',
  endsOn: '2026-09-13',
  ...over,
})

// Before the first dose, so nothing is skipped as past.
const before = new Date(2026, 8, 7, 6, 0)

describe('courseOccurrences', () => {
  it('covers three doses a day for seven days', () => {
    assert.equal(occurrenceCount(course(), before), 21)
  })

  it('stops on the end date rather than running forever', () => {
    const all = courseOccurrences(course(), before)
    const last = new Date(all[all.length - 1]!.at)
    assert.equal(last.getDate(), 13)
    assert.equal(last.getMonth(), 8)
  })

  it('produces occurrences in order', () => {
    const all = courseOccurrences(course(), before)
    for (let i = 1; i < all.length; i += 1) {
      assert.ok(all[i]!.at > all[i - 1]!.at, 'occurrences must be chronological')
    }
  })

  it('skips doses already in the past, which would otherwise fire instantly', () => {
    // Starting at 15:00 on day one, the 09:00 and 14:00 doses have gone.
    const midday = new Date(2026, 8, 7, 15, 0)
    assert.equal(occurrenceCount(course(), midday), 19)
  })

  it('honours a restricted set of days', () => {
    // Weekdays only, over the same week: 5 days x 3 doses.
    assert.equal(occurrenceCount(course({ days: [1, 2, 3, 4, 5] as Weekday[] }), before), 15)
  })

  it('applies lead times, so an early warning is its own occurrence', () => {
    const withLead = course({ times: ['09:00'], leadMinutes: [0, 10] })
    // Two firings a day for seven days.
    assert.equal(occurrenceCount(withLead, before), 14)
    const first = courseOccurrences(withLead, before)[0]!
    assert.equal(new Date(first.at).getHours(), 8)
    assert.equal(new Date(first.at).getMinutes(), 50)
  })

  it('returns nothing at all when there is no end date', () => {
    // An open-ended reminder is a repeating rule, not a course.
    assert.deepEqual(courseOccurrences(course({ endsOn: undefined }), before), [])
  })

  it('returns nothing for a malformed date rather than throwing', () => {
    assert.deepEqual(courseOccurrences(course({ endsOn: 'not-a-date' }), before), [])
  })
})

describe('describeCourse', () => {
  it('says the shape of the course in words', () => {
    const text = describeCourse({ times: ['09:00', '14:00', '21:00'], endsOn: '2026-09-13' })
    assert.ok(text?.startsWith('3 times a day until'), text ?? 'null')
  })

  it('uses the singular for a single daily dose', () => {
    const text = describeCourse({ times: ['09:00'], endsOn: '2026-09-13' })
    assert.ok(text?.startsWith('Once a day until'), text ?? 'null')
  })

  it('is null when the reminder is not a course', () => {
    assert.equal(describeCourse({ times: ['09:00'], endsOn: undefined }), null)
  })
})

describe('endDateAfterDays', () => {
  it('counts the first day as day one', () => {
    // A seven-day course starting on the 7th ends on the 13th, not the 14th.
    assert.equal(endDateAfterDays(new Date(2026, 8, 7), 7), '2026-09-13')
    assert.equal(endDateAfterDays(new Date(2026, 8, 7), 1), '2026-09-07')
  })
})
