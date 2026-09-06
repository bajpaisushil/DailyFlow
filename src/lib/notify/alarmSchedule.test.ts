import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  alarmId, alarmOccurrences, ownSoundOccurrences, wantsOwnSound, currentAlarmIds,
} from './alarmOccurrences.ts'
import { nativeFirings, nextNativeFirings } from './nativeFirings.ts'
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

/**
 * Playing a reminder's own sound ourselves.
 *
 * The bug: a user attached their own audio to an ordinary reminder and heard the phone's
 * default instead. Android reads a notification's sound from its channel, a channel can only
 * sound a file compiled into the app, and its sound can never change once created — so a file
 * the user picked could NEVER be what the OS plays. The only way is to be woken by
 * AlarmManager and play it ourselves.
 */
describe('ownSoundOccurrences', () => {
  const own = (over: Partial<Reminder> = {}) =>
    reminder({ alertStyle: 'notification', soundFile: 'abc.mp3', ...over })

  it('claims a notification-only reminder that has its own sound', () => {
    assert.equal(wantsOwnSound(own()), true)
    assert.equal(ownSoundOccurrences(own(), from, 7).length, 7)
  })

  it('leaves a bundled tone to the OS', () => {
    // A tone that ships with the app IS a valid channel sound, and the OS plays it even when
    // DailyFlow has been killed. Taking that over would be strictly worse.
    assert.equal(wantsOwnSound(own({ soundFile: undefined })), false)
    assert.deepEqual(ownSoundOccurrences(own({ soundFile: undefined }), from, 7), [])
  })

  it('leaves an alarm alone, because an alarm already plays the file', () => {
    for (const style of ['alarm', 'both'] as const) {
      assert.equal(wantsOwnSound(own({ alertStyle: style })), false)
    }
  })

  it('stays silent when the user turned the sound off', () => {
    assert.equal(wantsOwnSound(own({ sound: false })), false)
  })

  it('plays at the early warnings too, unlike an alarm', () => {
    // An alarm deliberately rings only at the real moment — seizing the screen half an hour
    // early is what makes people switch alarms off. Merely making a sound is not disruptive,
    // so a lead time should sound exactly like the reminder does.
    const out = ownSoundOccurrences(own({ leadMinutes: [0, 30] }), from, 1)
    assert.equal(out.length, 2)
    assert.deepEqual(
      out.map((at) => new Date(at).getHours() * 60 + new Date(at).getMinutes()),
      [5 * 60 + 30, 6 * 60],
    )
  })

  it('never claims a disabled reminder', () => {
    assert.deepEqual(ownSoundOccurrences(own({ enabled: false }), from, 7), [])
  })

  it('shares ids with the alarm path, so one cancel clears both', () => {
    // Both routes go through the same AlarmManager slot. If they produced different ids, a
    // reminder switched from alarm to notification would leave its old alarm ringing forever.
    const at = ownSoundOccurrences(own(), from, 1)[0]!
    assert.equal(alarmId('r1', at), `r1:${at}`)
  })
})

/**
 * What "What is set" can show.
 *
 * That screen exists so someone can check the PHONE really holds their reminders rather than
 * take the app's word for it. It reads the OS notification list — which silently became the
 * wrong question for alarms and for reminders playing their own sound, both of which go to
 * AlarmManager. AlarmManager cannot be enumerated, so these are recomputed from the very same
 * functions that scheduled them.
 */
describe('nativeFirings', () => {
  it('lists an alarm and an own-sound reminder together, soonest first', () => {
    const alarm = reminder({ id: 'a', times: ['07:00'], alertStyle: 'alarm' })
    const sound = reminder({
      id: 's', times: ['06:30'], alertStyle: 'notification', soundFile: 'x.mp3',
    })
    const out = nativeFirings([alarm, sound], from)
    assert.equal(out[0]!.kind, 'sound')
    assert.equal(out[1]!.kind, 'alarm')
    assert.ok(out[0]!.at < out[1]!.at)
  })

  it('says nothing about reminders the OS is handling', () => {
    // A plain reminder with a bundled tone IS in the notification list, and listing it here
    // too would show the user the same reminder twice.
    assert.deepEqual(nativeFirings([reminder({ alertStyle: 'notification' })], from), [])
  })

  it('carries the reminder title, which is the only thing the screen shows', () => {
    const out = nativeFirings([reminder({ title: 'Take insulin' })], from)
    assert.equal(out[0]!.title, 'Take insulin')
  })

  it('caps the list, because nobody reads forty rows', () => {
    assert.equal(nextNativeFirings([reminder()], 5, from).length, 5)
  })
})

/**
 * Cancelling what was ACTUALLY scheduled.
 *
 * The bug: cancellation re-derived the ids from the CURRENT reminders. That can only ever name
 * alarms the present configuration would create — so deleting a reminder, switching it off,
 * moving its time, or changing it from an alarm to a plain notification left its armed alarms
 * unnameable. They were never cancelled and rang every day for the fortnight they were laid
 * out for, and nothing in the app could reach them.
 *
 * These assert the property that makes the fix work: the id set derived from a CHANGED
 * reminder does not overlap the set that was really scheduled, which is exactly why the
 * derivation could never be used for cancellation.
 */
describe('stale alarm cancellation', () => {
  const armed = reminder({ times: ['07:00'], alertStyle: 'alarm' })
  const scheduled = alarmOccurrences(armed, from, 14).map((at) => alarmId(armed.id, at))

  it('schedules a fortnight of alarms, all of which need cancelling later', () => {
    assert.ok(scheduled.length >= 14)
  })

  it('a deleted reminder derives NO ids, so nothing would have been cancelled', () => {
    // removeReminder drops the reminder first, so the derivation sees an empty list.
    const derived = currentAlarmIds([], from)
    assert.deepEqual(derived, [])
    assert.ok(scheduled.length > 0, 'yet these were armed and would have kept ringing')
  })

  it('a disabled reminder derives NO ids', () => {
    assert.deepEqual(currentAlarmIds([reminder({ ...armed, enabled: false })], from), [])
  })

  it('a retimed reminder derives ids that were never scheduled', () => {
    const retimed = currentAlarmIds([reminder({ ...armed, times: ['09:00'] })], from)
    for (const id of retimed) {
      assert.ok(!scheduled.includes(id), `${id} was never armed, so cancelling it does nothing`)
    }
  })

  it('switching alarm to notification derives NO ids', () => {
    // The reminder still exists at the same time, which is what makes this one so easy to miss.
    assert.deepEqual(
      currentAlarmIds([reminder({ ...armed, alertStyle: 'notification' })], from),
      [],
    )
  })
})
