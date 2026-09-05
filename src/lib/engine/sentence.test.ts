import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildLookup, describeAutomation, describeCondition, describeTrigger } from './sentence.ts'
import type { Automation, Checklist, Place } from '../types.ts'

const place = (id: string, name: string): Place => ({
  id, name, icon: 'place', lat: 0, lon: 0, radiusM: 150,
  checklistIds: [], createdAt: 0, updatedAt: 0,
})

const list: Checklist = {
  id: 'c1', name: 'Work bag', icon: 'work', items: [],
  resetRule: { kind: 'daily' }, createdAt: 0, updatedAt: 0,
}

const lookup = buildLookup({
  places: [place('home', 'Home'), place('office', 'Office')],
  checklists: [list],
  routines: [{ id: 'r1', name: 'Work' }],
})

const opts = { use24h: false, locale: 'en' }

describe('describeTrigger — plain language, never jargon', () => {
  it('renders a clock time', () => {
    const s = describeTrigger({ kind: 'time.at', params: { time: '06:45' } }, lookup, opts)
    assert.ok(s.includes('6:45'), s)
  })

  it('names the place for arriving and leaving', () => {
    assert.ok(
      describeTrigger({ kind: 'place.enter', params: { placeId: 'office' } }, lookup, opts)
        .includes('Office'),
    )
    assert.ok(
      describeTrigger({ kind: 'place.exit', params: { placeId: 'home' } }, lookup, opts)
        .includes('leave Home'),
    )
  })

  it('degrades gracefully when a place has been deleted', () => {
    const s = describeTrigger({ kind: 'place.enter', params: { placeId: 'gone' } }, lookup, opts)
    assert.ok(s.includes('a place'), s)
    assert.ok(!s.includes('undefined'), s)
  })

  it('never leaks the words trigger, condition or automation', () => {
    const kinds = [
      describeTrigger({ kind: 'app.opened', params: {} }, lookup, opts),
      describeTrigger({ kind: 'day.started', params: {} }, lookup, opts),
      describeTrigger({ kind: 'battery.below', params: { percent: 20 } }, lookup, opts),
    ]
    for (const s of kinds) {
      for (const banned of ['trigger', 'condition', 'automation', 'geofence']) {
        assert.ok(!s.toLowerCase().includes(banned), `"${s}" leaked "${banned}"`)
      }
    }
  })
})

describe('describeCondition', () => {
  it('renders day sets in plain words', () => {
    const s = describeCondition(
      { kind: 'day.isOneOf', params: { days: [1, 2, 3, 4, 5] } }, lookup, opts,
    )
    assert.ok(s.includes('weekdays'), s)
  })

  it('honours negation for place and list conditions', () => {
    const at = describeCondition(
      { kind: 'place.currentlyAt', params: { placeId: 'home' } }, lookup, opts,
    )
    const notAt = describeCondition(
      { kind: 'place.currentlyAt', params: { placeId: 'home' }, negate: true }, lookup, opts,
    )
    assert.ok(at.includes('you are at Home'), at)
    assert.ok(notAt.includes('you are not at Home'), notAt)
  })
})

describe('describeAutomation — the whole rule as one sentence', () => {
  it('reads as the sentence a person would say', () => {
    const automation: Automation = {
      id: 'a1', name: 'x', enabled: true,
      trigger: { kind: 'time.at', params: { time: '06:45' } },
      conditions: [
        { kind: 'day.isOneOf', params: { days: [1, 2, 3, 4, 5] } },
        { kind: 'place.currentlyAt', params: { placeId: 'home' } },
      ],
      match: 'all',
      actions: [{
        kind: 'notify',
        params: { title: 'Work bag', priority: 'normal' },
      }],
      createdAt: 0, updatedAt: 0,
    }

    const s = describeAutomation(automation, lookup, opts)
    // "When at 6:45 AM, and it is weekdays and you are at Home, DailyFlow will tell you ..."
    assert.ok(s.startsWith('When '), s)
    assert.ok(s.includes('6:45'), s)
    assert.ok(s.includes('weekdays'), s)
    assert.ok(s.includes('Home'), s)
    assert.ok(s.includes('Work bag'), s)
    assert.ok(s.endsWith('.'), s)
  })

  it('joins with "or" when the rule matches any condition', () => {
    const automation: Automation = {
      id: 'a2', name: 'x', enabled: true,
      trigger: { kind: 'app.opened', params: {} },
      conditions: [
        { kind: 'mode.isOn', params: { mode: 'travel' } },
        { kind: 'network.isOffline', params: {} },
      ],
      match: 'any',
      actions: [{ kind: 'notify', params: { title: 'Hello', priority: 'quiet' } }],
      createdAt: 0, updatedAt: 0,
    }
    assert.ok(describeAutomation(automation, lookup, opts).includes(' or '))
  })

  it('renders 24-hour times when the user prefers them', () => {
    const automation: Automation = {
      id: 'a3', name: 'x', enabled: true,
      trigger: { kind: 'time.at', params: { time: '18:30' } },
      conditions: [], match: 'all',
      actions: [{ kind: 'notify', params: { title: 'Go home', priority: 'normal' } }],
      createdAt: 0, updatedAt: 0,
    }
    const s = describeAutomation(automation, lookup, { use24h: true, locale: 'en' })
    assert.ok(s.includes('18:30'), s)
    assert.ok(!s.includes('PM'), s)
  })
})
