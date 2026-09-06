import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_PENDING, planFor } from './plan.ts'
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
