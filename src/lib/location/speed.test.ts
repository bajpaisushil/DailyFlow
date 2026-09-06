import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_SPEED_KMH, describeSpeed, estimateSpeedKmh, learnSpeed, toKmh } from './speed.ts'

describe('toKmh', () => {
  it('converts a usable reading', () => {
    assert.equal(Math.round(toKmh({ metresPerSecond: 12.5 })!), 45)
  })

  it('rejects a standing-still reading rather than treating it as fact', () => {
    // Someone waiting on a platform is not travelling at 1 km/h towards anything.
    assert.equal(toKmh({ metresPerSecond: 0 }), null)
    assert.equal(toKmh({ metresPerSecond: 0.2 }), null)
  })

  it('rejects nonsense the platform sometimes reports', () => {
    assert.equal(toKmh({ metresPerSecond: null }), null)
    assert.equal(toKmh({ metresPerSecond: undefined }), null)
    assert.equal(toKmh({ metresPerSecond: -5 }), null)
    assert.equal(toKmh({ metresPerSecond: 500 }), null)
    assert.equal(toKmh({ metresPerSecond: Number.NaN }), null)
  })
})

describe('estimateSpeedKmh', () => {
  it('trusts the current reading above everything, since it describes this trip', () => {
    assert.equal(estimateSpeedKmh({ observedSpeedKmh: 10 }, 45), 45)
  })

  it('falls back to what the place has learned', () => {
    assert.equal(estimateSpeedKmh({ observedSpeedKmh: 40 }, null), 40)
  })

  it('falls back to a middling default when nothing is known', () => {
    assert.equal(estimateSpeedKmh({}, null), DEFAULT_SPEED_KMH)
  })

  it('ignores a current reading that is standing still or absurd', () => {
    assert.equal(estimateSpeedKmh({ observedSpeedKmh: 40 }, 0.5), 40)
    assert.equal(estimateSpeedKmh({ observedSpeedKmh: 40 }, 900), 40)
  })
})

describe('learnSpeed', () => {
  it('takes the first observation as the starting estimate', () => {
    assert.equal(learnSpeed({}, 45), 45)
  })

  it('moves gradually, so one odd trip cannot swing it', () => {
    // 30 km/h known, one 60 km/h trip: the estimate should shift a little, not double.
    const next = learnSpeed({ observedSpeedKmh: 30 }, 60)!
    assert.ok(next > 30 && next < 45, `expected a small move, got ${next}`)
  })

  it('keeps what it had when the sample was unusable', () => {
    assert.equal(learnSpeed({ observedSpeedKmh: 30 }, null), null)
  })
})

describe('describeSpeed', () => {
  it('says it in words, because a speed is only ever shown as reassurance', () => {
    assert.equal(describeSpeed(5), 'walking pace')
    assert.equal(describeSpeed(15), 'cycling pace')
    assert.equal(describeSpeed(30), 'road speed')
    assert.equal(describeSpeed(50), 'train speed')
  })
})
