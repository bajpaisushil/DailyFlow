import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseRegionId, radiiForPlace, regionId } from './regions.ts'
import type { Place, Reminder, Weekday } from '../types.ts'

/**
 * One geofence region per DISTINCT RADIUS, not one per place.
 *
 * The bug this pins: a single circle sized by the widest request meant that if one reminder
 * asked to be woken six minutes before the office (4.5 km) and another simply said "when I
 * arrive at the office", both fired at 4.5 km — the arrival reminder went off three stops
 * early, every single day.
 */

const office: Place = {
  id: 'office', name: 'Office', icon: 'work', lat: 28.48, lon: 77.09,
  radiusM: 150, checklistIds: [], createdAt: 0, updatedAt: 0,
}

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1', title: 'x', icon: 'bell', enabled: true,
    times: [], days: [] as Weekday[], placeTriggers: [], leadMinutes: [0],
    priority: 'normal', alertStyle: 'notification', sound: true, vibrate: true,
    createdAt: 0, updatedAt: 0, ...over,
  }
}

describe('regionId', () => {
  it('round-trips a place and its radius', () => {
    const { placeId, radiusM } = parseRegionId(regionId('office', 4500))
    assert.equal(placeId, 'office')
    assert.equal(radiusM, 4500)
  })

  it('survives a place id containing a hash', () => {
    const { placeId, radiusM } = parseRegionId(regionId('od#d', 150))
    assert.equal(placeId, 'od#d')
    assert.equal(radiusM, 150)
  })

  it('tolerates an identifier from an older version with no radius', () => {
    const { placeId, radiusM } = parseRegionId('office')
    assert.equal(placeId, 'office')
    assert.equal(radiusM, null)
  })
})

describe('radiiForPlace', () => {
  it("uses the place's own circle when nothing asks for an early warning", () => {
    const radii = radiiForPlace(office, [
      reminder({ placeTriggers: [{ id: 't', placeId: 'office', on: 'arrive' }] }),
    ])
    assert.deepEqual(radii, [150])
  })

  it('gives an approach request its own, much larger circle', () => {
    const radii = radiiForPlace(office, [
      reminder({
        placeTriggers: [{ id: 't', placeId: 'office', on: 'arrive', approachMinutes: 6 }],
      }),
    ])
    assert.equal(radii.length, 1)
    assert.ok(radii[0]! > 2000, `expected kilometres, got ${radii[0]}`)
  })

  it('watches BOTH circles when one reminder wants each — the actual bug', () => {
    const radii = radiiForPlace(office, [
      reminder({ id: 'a', placeTriggers: [{ id: 't1', placeId: 'office', on: 'arrive' }] }),
      reminder({
        id: 'b',
        placeTriggers: [{ id: 't2', placeId: 'office', on: 'arrive', approachMinutes: 6 }],
      }),
    ])
    assert.equal(radii.length, 2, 'both the arrival circle and the early-warning circle')
    assert.equal(radii[0], 150, 'smallest first')
    assert.ok(radii[1]! > 2000)
  })

  it('does not duplicate a circle two reminders happen to share', () => {
    const radii = radiiForPlace(office, [
      reminder({ id: 'a', placeTriggers: [{ id: 't1', placeId: 'office', on: 'arrive' }] }),
      reminder({ id: 'b', placeTriggers: [{ id: 't2', placeId: 'office', on: 'leave' }] }),
    ])
    assert.deepEqual(radii, [150])
  })

  it('ignores disabled reminders and other places', () => {
    const radii = radiiForPlace(office, [
      reminder({
        id: 'off', enabled: false,
        placeTriggers: [{ id: 't', placeId: 'office', on: 'arrive', approachMinutes: 20 }],
      }),
      reminder({
        id: 'elsewhere',
        placeTriggers: [{ id: 't', placeId: 'home', on: 'arrive', approachMinutes: 20 }],
      }),
    ])
    assert.deepEqual(radii, [150])
  })

  it('never returns a circle below the GPS-error floor', () => {
    const tiny: Place = { ...office, radiusM: 10 }
    assert.equal(radiiForPlace(tiny, [
      reminder({ placeTriggers: [{ id: 't', placeId: 'office', on: 'arrive' }] }),
    ])[0], 80)
  })
})
