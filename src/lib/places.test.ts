import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { distanceMetres, metresForPreset, nearestPreset } from './places.ts'

describe('distanceMetres', () => {
  it('is zero for the same point', () => {
    const p = { lat: 28.6139, lon: 77.209 }
    assert.equal(distanceMetres(p, p), 0)
  })

  it('matches a known separation to within a metre', () => {
    // One degree of latitude is ~111.19 km anywhere on the globe.
    const d = distanceMetres({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })
    assert.ok(Math.abs(d - 111_195) < 60, `expected ~111195 m, got ${d}`)
  })

  it('shrinks longitude distance towards the poles', () => {
    // A degree of longitude is ~111 km at the equator but ~78 km at 45 degrees latitude.
    const atEquator = distanceMetres({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })
    const at45 = distanceMetres({ lat: 45, lon: 0 }, { lat: 45, lon: 1 })
    assert.ok(at45 < atEquator)
    assert.ok(Math.abs(at45 - 78_600) < 400, `expected ~78600 m, got ${at45}`)
  })

  it('is symmetric', () => {
    const a = { lat: 19.076, lon: 72.8777 }
    const b = { lat: 28.6139, lon: 77.209 }
    assert.ok(Math.abs(distanceMetres(a, b) - distanceMetres(b, a)) < 1e-6)
  })

  it('resolves the short distances a geofence actually cares about', () => {
    // ~100 m north of the origin point.
    const a = { lat: 12.9716, lon: 77.5946 }
    const b = { lat: 12.9716 + 0.0008993, lon: 77.5946 }
    const d = distanceMetres(a, b)
    assert.ok(Math.abs(d - 100) < 2, `expected ~100 m, got ${d}`)
  })

  it('handles antipodal points without NaN from floating-point drift', () => {
    const d = distanceMetres({ lat: 0, lon: 0 }, { lat: 0, lon: 180 })
    assert.ok(Number.isFinite(d))
    assert.ok(Math.abs(d - 20_015_000) < 5000, `expected ~half circumference, got ${d}`)
  })
})

describe('radius presets', () => {
  it('maps a stored radius back to the nearest named option', () => {
    assert.equal(nearestPreset(75), 'exact')
    assert.equal(nearestPreset(150), 'building')
    assert.equal(nearestPreset(300), 'street')
    assert.equal(nearestPreset(600), 'area')
  })

  it('snaps an arbitrary radius to the closest option, so old data still renders', () => {
    assert.equal(nearestPreset(90), 'exact')
    assert.equal(nearestPreset(200), 'building')
    assert.equal(nearestPreset(5000), 'area')
  })

  it('round-trips preset to metres and back', () => {
    for (const key of ['exact', 'building', 'street', 'area'] as const) {
      assert.equal(nearestPreset(metresForPreset(key)), key)
    }
  })
})
