import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { alreadyThere, currentPlace, describePresence } from './presence.ts'
import type { ActivityEvent, Place } from './types.ts'

const temple: Place = {
  id: 'temple', name: 'Temple', icon: 'temple', lat: 0, lon: 0,
  radiusM: 150, checklistIds: [], createdAt: 0, updatedAt: 0,
}
const home: Place = { ...temple, id: 'home', name: 'Home', icon: 'home' }

const NOW = 1_700_000_000_000
const mins = (n: number) => NOW - n * 60_000

/** The log is stored newest-first, as `activity.recent()` returns it. */
function log(...events: Array<Partial<ActivityEvent>>): ActivityEvent[] {
  return events.map((e, i) => ({
    id: `e${i}`, at: NOW, kind: 'place.entered', summary: '', ...e,
  })) as ActivityEvent[]
}

describe('currentPlace', () => {
  it('knows the user is somewhere after an arrival', () => {
    const at = currentPlace(
      log({ kind: 'place.entered', placeId: 'temple', at: mins(10) }),
      [temple], NOW,
    )
    assert.equal(at?.place.id, 'temple')
  })

  it('knows they have gone once a departure follows', () => {
    const at = currentPlace(
      log(
        { kind: 'place.exited', placeId: 'temple', at: mins(5) },
        { kind: 'place.entered', placeId: 'temple', at: mins(30) },
      ),
      [temple], NOW,
    )
    assert.equal(at, null)
  })

  it('takes the latest event per place, not the first it finds', () => {
    // Arrived, left, arrived again: still there.
    const at = currentPlace(
      log(
        { kind: 'place.entered', placeId: 'temple', at: mins(2) },
        { kind: 'place.exited', placeId: 'temple', at: mins(20) },
        { kind: 'place.entered', placeId: 'temple', at: mins(60) },
      ),
      [temple], NOW,
    )
    assert.equal(at?.place.id, 'temple')
  })

  it('distrusts an arrival from yesterday', () => {
    // The user may have left with the app closed, so no departure was ever recorded.
    const at = currentPlace(
      log({ kind: 'place.entered', placeId: 'temple', at: mins(60 * 20) }),
      [temple], NOW,
    )
    assert.equal(at, null)
  })

  it('ignores a place that has been deleted', () => {
    const at = currentPlace(
      log({ kind: 'place.entered', placeId: 'temple', at: mins(5) }),
      [{ ...temple, deletedAt: NOW }], NOW,
    )
    assert.equal(at, null)
  })

  it('returns the most recent arrival when two places are logged', () => {
    const at = currentPlace(
      log(
        { kind: 'place.entered', placeId: 'temple', at: mins(5) },
        { kind: 'place.entered', placeId: 'home', at: mins(90) },
      ),
      [temple, home], NOW,
    )
    assert.equal(at?.place.id, 'temple')
  })

  it('is null when nothing has been recorded', () => {
    assert.equal(currentPlace([], [temple], NOW), null)
  })
})

describe('alreadyThere', () => {
  it('is true when standing in the place being travelled to', () => {
    assert.equal(alreadyThere({ place: temple, since: NOW }, 'temple'), true)
  })

  it('is false elsewhere, and false when nothing is known', () => {
    assert.equal(alreadyThere({ place: home, since: NOW }, 'temple'), false)
    assert.equal(alreadyThere(null, 'temple'), false)
    assert.equal(alreadyThere({ place: temple, since: NOW }, undefined), false)
  })
})

describe('describePresence', () => {
  it('names the place plainly', () => {
    assert.equal(describePresence({ place: temple, since: NOW }), 'You are at Temple')
  })
})
