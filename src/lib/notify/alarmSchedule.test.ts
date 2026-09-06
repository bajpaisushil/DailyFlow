import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { alarmId, alarmOccurrences } from './alarmOccurrences.ts'
import type { Reminder, Weekday } from '../types.ts'

/**
 * Which moments a reminder should actually RING at.
 *
 * The bug this exists for: alarms were only wired into the geofence path, so a timed alarm
 * went to the notification scheduler and could never take over the screen — our JavaScript is
 * not even running when the moment arrives.
 */

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1', title: 'Wake up', icon: 'clock', enabled: true,
    times: ['06:00'], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    priority: 'normal', alertStyle: 'alarm', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0, ...over,
  }
}

// A Monday, before the first alarm of the day.
const from = new Date(2026, 8, 7, 5, 0)

describe('alarmOccurrences', () => {
  it('lays out one ring per day across the horizon', () => {
    const out = alarmOccurrences(reminder(), from, 7)
    assert.equal(out.length, 7)
    assert.equal(new Date(out[0]!).getHours(), 6)
  })

  it('produces nothing for a reminder that is not an alarm', () => {
    // Ordinary reminders must stay on the notification path; seizing the screen for those
    // would be the feature people switch off entirely.
    assert.deepEqual(alarmOccurrences(reminder({ alertStyle: 'notification' }), from, 7), [])
  })

  it('produces nothing for a disabled reminder', () => {
    assert.deepEqual(alarmOccurrences(reminder({ enabled: false }), from, 7), [])
  })

  it('produces nothing when there is no time to ring at', () => {
    // A purely location-based alarm is handled by the geofence, not the clock.
    assert.deepEqual(alarmOccurrences(reminder({ times: [] }), from, 7), [])
  })

  it('honours the chosen days', () => {
    // Weekdays only, over two weeks: ten rings.
    const out = alarmOccurrences(reminder({ days: [1, 2, 3, 4, 5] as Weekday[] }), from, 14)
    assert.equal(out.length, 10)
    for (const at of out) {
      const day = new Date(at).getDay()
      assert.ok(day >= 1 && day <= 5, `rang on day ${day}`)
    }
  })

  it('never schedules a moment already past', () => {
    // Starting at 07:00, today's 06:00 has gone; the first ring is tomorrow.
    const late = new Date(2026, 8, 7, 7, 0)
    const out = alarmOccurrences(reminder(), late, 2)
    assert.equal(new Date(out[0]!).getDate(), 8)
  })

  it("with 'both', only the moment itself rings — early warnings stay quiet", () => {
    // A nudge half an hour ahead that seizes the screen is one people switch off over.
    const out = alarmOccurrences(
      reminder({ alertStyle: 'both', times: ['06:00'], leadMinutes: [30, 0] }),
      from, 1,
    )
    assert.equal(out.length, 1)
    assert.equal(new Date(out[0]!).getHours(), 6)
    assert.equal(new Date(out[0]!).getMinutes(), 0)
  })

  it("with 'alarm', every lead time rings", () => {
    const out = alarmOccurrences(
      reminder({ alertStyle: 'alarm', times: ['06:00'], leadMinutes: [30, 0] }),
      from, 1,
    )
    assert.equal(out.length, 2)
  })

  it('stops a bounded course on its end date', () => {
    const out = alarmOccurrences(
      reminder({ times: ['09:00'], endsOn: '2026-09-09' }),
      from, 30,
    )
    assert.ok(out.length > 0)
    assert.ok(new Date(out[out.length - 1]!).getDate() <= 9)
  })

  it('caps a runaway configuration rather than filling the OS alarm table', () => {
    const out = alarmOccurrences(
      reminder({ times: ['06:00', '12:00', '18:00', '21:00'] }),
      from, 60,
    )
    assert.ok(out.length <= 40, `expected a cap, got ${out.length}`)
  })

  it('returns moments in order', () => {
    const out = alarmOccurrences(reminder({ times: ['21:00', '06:00'] }), from, 3)
    for (let i = 1; i < out.length; i += 1) assert.ok(out[i]! > out[i - 1]!)
  })
})

describe('alarmId', () => {
  it('is stable and distinct per moment, so rescheduling addresses the same alarm', () => {
    assert.equal(alarmId('r1', 123), alarmId('r1', 123))
    assert.notEqual(alarmId('r1', 123), alarmId('r1', 456))
    assert.notEqual(alarmId('r1', 123), alarmId('r2', 123))
  })
})
