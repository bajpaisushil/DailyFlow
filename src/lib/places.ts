import { RADIUS_PRESETS, type RadiusPresetKey } from '@/lib/types'
import { S } from '@/lib/strings'

/**
 * Place helpers.
 *
 * A hard rule from the low-literacy research: a distance is NEVER presented to the user as a
 * number of metres. Roughly half of adults have primary-school numeracy, and "150 m" is not a
 * decision anyone can make confidently. The user picks from named, pictured options; the metres
 * stay internal to the geofence maths.
 */

export function describeRadius(metres: number): string {
  const preset = nearestPreset(metres)
  switch (preset) {
    case 'exact': return S.place.closeExact
    case 'building': return S.place.closeBuilding
    case 'street': return S.place.closeStreet
    case 'area': return S.place.closeArea
  }
}

export function helpForRadius(metres: number): string {
  const preset = nearestPreset(metres)
  switch (preset) {
    case 'exact': return S.place.closeExactHelp
    case 'building': return S.place.closeBuildingHelp
    case 'street': return S.place.closeStreetHelp
    case 'area': return S.place.closeAreaHelp
  }
}

export function nearestPreset(metres: number): RadiusPresetKey {
  let best: RadiusPresetKey = 'building'
  let bestDelta = Number.POSITIVE_INFINITY
  for (const p of RADIUS_PRESETS) {
    const delta = Math.abs(p.metres - metres)
    if (delta < bestDelta) {
      bestDelta = delta
      best = p.key
    }
  }
  return best
}

export function metresForPreset(key: RadiusPresetKey): number {
  return RADIUS_PRESETS.find((p) => p.key === key)?.metres ?? 150
}

const EARTH_RADIUS_M = 6_371_000

/**
 * Great-circle distance in metres. Haversine is well within tolerance at the scales we care
 * about (tens to hundreds of metres) and is far cheaper than Vincenty.
 */
export function distanceMetres(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const toRad = Math.PI / 180
  const dLat = (b.lat - a.lat) * toRad
  const dLon = (b.lon - a.lon) * toRad
  const lat1 = a.lat * toRad
  const lat2 = b.lat * toRad

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}
