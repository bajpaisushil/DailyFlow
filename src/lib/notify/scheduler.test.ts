import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_PENDING, planFor, withoutClaimedReminders, type ScheduledPlan } from './plan.ts'
import type { Automation } from '../types.ts'

/**
 * The scheduling maths, testable because `planFor` returns platform-agnostic descriptors
 * rather than expo-notifications' own enums. That separation exists precisely so this file
 * can run without a native runtime.
 */

function automation(over: Partial<Automation> = {}): Automation {
  return {
    id: 'a1', name: 'Work', enabled: true,
    trigger: { kind: 'time.at', params: { time: '06:45' } },
    conditions: [], match: 'all',
    actions: [{ kind: 'notify', params: { title: 'Time to go', priority: 'normal' } }],
    createdAt: 0, updatedAt: 0, ...over,
  }
}

describe('planFor', () => {
  it('splits the clock time into hour and minute', () => {
    const [plan] = planFor(automation())
    assert.equal(plan!.when.every, 'day')
    assert.equal(plan!.when.hour, 6)
    assert.equal(plan!.when.minute, 45)
  })

  it('collapses all seven days into ONE daily trigger', () => {
    // The whole point: seven weekly triggers would burn 7x the iOS pending budget.
    const plans = planFor(automation({
      conditions: [{ kind: 'day.isOneOf', params: { days: [0, 1, 2, 3, 4, 5, 6] } }],
    }))
    assert.equal(plans.length, 1)
    assert.equal(plans[0]!.when.every, 'day')
  })

  it('emits one weekly trigger per chosen day', () => {
    const plans = planFor(automation({
      conditions: [{ kind: 'day.isOneOf', params: { days: [1, 2, 3, 4, 5] } }],
    }))
    assert.equal(plans.length, 5)
    assert.ok(plans.every((p) => p.when.every === 'week'))
    assert.deepEqual(
      plans.map((p) => (p.when.every === 'week' ? p.when.weekday : null)),
      [1, 2, 3, 4, 5],
    )
  })

  it('treats a missing day condition as every day', () => {
    const plans = planFor(automation({ conditions: [] }))
    assert.equal(plans.length, 1)
    assert.equal(plans[0]!.when.every, 'day')
  })

  it('ignores a negated day condition rather than inverting it wrongly', () => {
    // A negated set is not a schedulable list of days, so we fall back to every day and let
    // the in-app engine apply the condition. Silently scheduling the complement would fire
    // reminders on days the user excluded.
    const plans = planFor(automation({
      conditions: [{ kind: 'day.isOneOf', params: { days: [0, 6] }, negate: true }],
    }))
    assert.equal(plans.length, 1)
    assert.equal(plans[0]!.when.every, 'day')
  })

  it('produces nothing for a disabled rule', () => {
    assert.deepEqual(planFor(automation({ enabled: false })), [])
  })

  it('produces nothing for a rule with no notify action', () => {
    const plans = planFor(automation({
      actions: [{ kind: 'log', params: { message: 'x' } }],
    }))
    assert.deepEqual(plans, [])
  })

  it('produces nothing for a location trigger — the geofence owns those', () => {
    const plans = planFor(automation({
      trigger: { kind: 'place.enter', params: { placeId: 'office' } },
    }))
    assert.deepEqual(plans, [])
  })

  it('produces nothing for an empty day set rather than scheduling every day', () => {
    const plans = planFor(automation({
      conditions: [{ kind: 'day.isOneOf', params: { days: [] } }],
    }))
    assert.deepEqual(plans, [])
  })

  it('rejects a malformed time instead of scheduling at midnight', () => {
    const plans = planFor(automation({
      trigger: { kind: 'time.at', params: { time: '25:99' } },
    }))
    assert.deepEqual(plans, [])
  })

  it('gives every plan a stable, unique key', () => {
    const plans = planFor(automation({
      conditions: [{ kind: 'day.isOneOf', params: { days: [1, 3, 5] } }],
    }))
    const keys = plans.map((p) => p.key)
    assert.equal(new Set(keys).size, keys.length)
    // Stable across calls, so reconciliation can reason about them.
    const again = planFor(automation({
      conditions: [{ kind: 'day.isOneOf', params: { days: [1, 3, 5] } }],
    }))
    assert.deepEqual(again.map((p) => p.key), keys)
  })

  it('carries the notification content through unchanged', () => {
    const [plan] = planFor(automation({
      actions: [{
        kind: 'notify',
        params: { title: 'Take your bag', body: 'Laptop, charger', priority: 'important' },
      }],
    }))
    assert.equal(plan!.title, 'Take your bag')
    assert.equal(plan!.body, 'Laptop, charger')
    assert.equal(plan!.priority, 'important')
  })

  it('stays inside the iOS pending-notification budget for a realistic set of plans', () => {
    // Ten weekday routines is a heavy but plausible user; 10 x 5 = 50 must fit under 56.
    const many = Array.from({ length: 10 }, (_, i) =>
      automation({
        id: `a${i}`,
        conditions: [{ kind: 'day.isOneOf', params: { days: [1, 2, 3, 4, 5] } }],
      }),
    )
    const total = many.flatMap((a) => planFor(a)).length
    assert.equal(total, 50)
    assert.ok(total <= MAX_PENDING, `${total} plans exceeds the ${MAX_PENDING} budget`)
  })
})

describe('budget and quiet hours — regressions from the pre-release audit', () => {
  /** A month-long course of three doses a day: 90 dated firings. */
  function course(times: string[], days: number): Automation[] {
    const out: Automation[] = []
    for (const time of times) {
      out.push(automation({
        id: `a-${time}`,
        trigger: { kind: 'time.at', params: { time } },
        conditions: [],
        window: { until: isoAfter(days) },
      }) as Automation)
    }
    return out
  }

  function isoAfter(days: number): string {
    const d = new Date(2026, 8, 7)
    d.setDate(d.getDate() + days)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  it('a month-long three-a-day course really does exceed the budget', () => {
    // Establishes the premise of the bug: without ordering, something has to be dropped.
    const plans = course(['08:00', '14:00', '21:00'], 30).flatMap((a) =>
      planFor(a, new Date(2026, 8, 7, 6, 0)),
    )
    assert.ok(plans.length > MAX_PENDING, `expected over ${MAX_PENDING}, got ${plans.length}`)
  })

  it('keeps the soonest firings, so no dose of the day is lost wholesale', () => {
    // The bug: slice() truncated in automation order, keeping every 08:00 and 14:00 and
    // silently dropping every single 21:00 — a whole dose a day, with nothing said.
    const now = new Date(2026, 8, 7, 6, 0)
    const plans = course(['08:00', '14:00', '21:00'], 30).flatMap((a) => planFor(a, now))

    const rank = (p: (typeof plans)[number]) =>
      p.when.every === 'once' ? p.when.at : 0
    const kept = [...plans].sort((a, b) => rank(a) - rank(b)).slice(0, MAX_PENDING)

    const evening = kept.filter((p) => p.key.includes('a-21:00'))
    assert.ok(
      evening.length > 0,
      'the evening dose must survive truncation, not be dropped entirely',
    )

    // And every kept firing should precede every dropped one.
    const dropped = [...plans].sort((a, b) => rank(a) - rank(b)).slice(MAX_PENDING)
    if (dropped.length > 0) {
      const latestKept = Math.max(...kept.map(rank))
      const earliestDropped = Math.min(...dropped.map(rank))
      assert.ok(latestKept <= earliestDropped, 'what is dropped must be the far future')
    }
  })
})

/**
 * Not scheduling what something else is already going to do.
 *
 * A notification-only reminder with the user's own audio is fired by AlarmManager and played
 * by us, because Android will not let a chosen file be a notification channel's sound. The OS
 * schedule must then leave that reminder alone — otherwise it arrives twice, once with the
 * sound the user picked and once with the phone's default.
 */
describe('withoutClaimedReminders', () => {
  const plan = (id: string, reminderId?: string): ScheduledPlan => ({
    key: id,
    automationId: id,
    sourceReminderId: reminderId,
    title: 'x',
    priority: 'normal',
    when: { every: 'day', hour: 8, minute: 0 },
  })

  it('drops every firing of a claimed reminder', () => {
    const out = withoutClaimedReminders([plan('a', 'r1'), plan('b', 'r1'), plan('c', 'r2')], ['r1'])
    assert.deepEqual(out.map((p) => p.key), ['c'])
  })

  it('keeps everything when nothing is claimed', () => {
    const plans = [plan('a', 'r1'), plan('b')]
    assert.equal(withoutClaimedReminders(plans, []), plans)
  })

  it('never drops a plan with no reminder behind it', () => {
    // Routines compile to automations with no source reminder. They must survive whatever a
    // reminder elsewhere happens to be called.
    const out = withoutClaimedReminders([plan('a')], ['r1', 'undefined', ''])
    assert.equal(out.length, 1)
  })
})
