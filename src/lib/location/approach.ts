import type { Place, PlaceTrigger } from '@/lib/types'
import { DEFAULT_SPEED_KMH, describeSpeed, estimateSpeedKmh } from './speed'

/**
 * Turning "wake me six minutes before my stop" into a geofence radius.
 *
 * A geofence is a circle, so an early warning is simply a bigger one: cross it, and you are
 * roughly that many minutes out. Speed is asked for rather than guessed because six minutes
 * of walking is 500 m and six minutes on a metro is four and a half kilometres — using one
 * number for both would make the feature useless for whichever case it did not match.
 */

/** The largest circle we will ask the OS to watch. Beyond this it stops being meaningful. */
export const MAX_APPROACH_RADIUS_M = 20_000

export function approachRadiusMetres(
  trigger: PlaceTrigger,
  placeRadiusM: number,
  place?: Pick<Place, 'observedSpeedKmh'>,
): number {
  const minutes = trigger.approachMinutes ?? 0
  if (minutes <= 0) return placeRadiusM

  // Speed is worked out, not asked for: what the place has learned, else a middling default.
  // `approachSpeedKmh` survives only so reminders saved before this change keep working.
  const kmh = trigger.approachSpeedKmh ?? (place ? estimateSpeedKmh(place) : DEFAULT_SPEED_KMH)
  const metres = (kmh * 1000 / 60) * minutes

  // Never smaller than the place itself, never larger than is useful.
  return Math.min(MAX_APPROACH_RADIUS_M, Math.max(placeRadiusM, Math.round(metres)))
}

/** Plain words for the distance, so the user can sanity-check what they chose. */
export function describeApproach(
  trigger: PlaceTrigger,
  placeRadiusM: number,
  place?: Pick<Place, 'observedSpeedKmh'>,
): string {
  const minutes = trigger.approachMinutes ?? 0
  if (minutes <= 0) return 'When you get there'

  const metres = approachRadiusMetres(trigger, placeRadiusM, place)
  const distance = metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${Math.round(metres / 10) * 10} m`

  const kmh = trigger.approachSpeedKmh ?? (place ? estimateSpeedKmh(place) : DEFAULT_SPEED_KMH)
  return `About ${minutes} minutes before — roughly ${distance} away, at ${describeSpeed(kmh)}`
}
