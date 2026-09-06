import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { approachRadiusMetres, describeApproach, MAX_APPROACH_RADIUS_M } from './approach.ts'
import type { PlaceTrigger } from '../types.ts'

const trigger = (over: Partial<PlaceTrigger> = {}): PlaceTrigger => ({
  id: 't1', placeId: 'p1', on: 'arrive', ...over,
})

describe('approachRadiusMetres', () => {
  it('falls back to the place radius when no early warning is wanted', () => {
    assert.equal(approachRadiusMetres(trigger(), 150), 150)
    assert.equal(approachRadiusMetres(trigger({ approachMinutes: 0 }), 150), 150)
  })

  it('turns "six minutes before on a metro" into a real distance', () => {
    // 45 km/h for 6 minutes is 4.5 km — the circle that wakes you before your stop.
    const radius = approachRadiusMetres(trigger({ approachMinutes: 6, approachSpeedKmh: 45 }), 150)
    assert.equal(radius, 4500)
  })

  it('scales with how you are travelling, which is the reason speed is asked at all', () => {
    const walking = approachRadiusMetres(trigger({ approachMinutes: 6, approachSpeedKmh: 5 }), 150)
    const metro = approachRadiusMetres(trigger({ approachMinutes: 6, approachSpeedKmh: 45 }), 150)
    assert.equal(walking, 500)
    assert.ok(metro > walking * 8, 'six minutes of walking and of metro must differ hugely')
  })

  it('never returns a circle smaller than the place itself', () => {
    const radius = approachRadiusMetres(trigger({ approachMinutes: 1, approachSpeedKmh: 5 }), 600)
    assert.equal(radius, 600)
  })

  it('caps the circle so it stays meaningful', () => {
    const radius = approachRadiusMetres(trigger({ approachMinutes: 600, approachSpeedKmh: 45 }), 150)
    assert.equal(radius, MAX_APPROACH_RADIUS_M)
  })
})

describe('describeApproach', () => {
  it('says the distance in words so the choice can be sanity-checked', () => {
    const text = describeApproach(trigger({ approachMinutes: 6, approachSpeedKmh: 45 }), 150)
    assert.ok(text.includes('6 minutes'), text)
    assert.ok(text.includes('4.5 km'), text)
  })

  it('uses metres for short distances', () => {
    const text = describeApproach(trigger({ approachMinutes: 5, approachSpeedKmh: 5 }), 100)
    assert.ok(text.includes('m'), text)
    assert.ok(!text.includes('km'), text)
  })

  it('says plainly when there is no early warning', () => {
    assert.equal(describeApproach(trigger(), 150), 'When you get there')
  })
})
