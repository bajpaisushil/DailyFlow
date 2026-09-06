import type { Place, Reminder } from '@/lib/types'
import { approachRadiusMetres } from './approach'

/**
 * Which circles to watch around each place — pure, so it can be tested without a native
 * runtime. `geofence.ts` turns these into the OS's own region objects.
 *
 * ONE REGION PER DISTINCT RADIUS, not one per place. A single circle sized by the widest
 * request meant that if one reminder asked to be woken six minutes before the office (a
 * 4.5 km circle) and another simply said "when I arrive at the office", BOTH fired at 4.5 km
 * — so the arrival reminder went off three stops early, every day.
 */

/** Below this, ordinary GPS error would make a region fire at random. */
export const MIN_RADIUS_M = 80

/** Region identifiers carry the radius, so a firing can be matched to what asked for it. */
export function regionId(placeId: string, radiusM: number): string {
  return `${placeId}#${Math.round(radiusM)}`
}

export function parseRegionId(identifier: string): { placeId: string; radiusM: number | null } {
  // lastIndexOf, because an id may itself contain a hash.
  const hash = identifier.lastIndexOf('#')
  if (hash < 0) return { placeId: identifier, radiusM: null }
  const radius = Number.parseInt(identifier.slice(hash + 1), 10)
  return {
    placeId: identifier.slice(0, hash),
    radiusM: Number.isFinite(radius) ? radius : null,
  }
}

/** Every distinct radius a place is watched at, smallest first. */
export function radiiForPlace(place: Place, reminders: Reminder[]): number[] {
  const radii = new Set<number>()
  let plainRequested = false

  for (const reminder of reminders) {
    if (!reminder.enabled) continue
    for (const trigger of reminder.placeTriggers) {
      if (trigger.placeId !== place.id) continue
      if (trigger.on === 'arrive' && trigger.approachMinutes) {
        radii.add(Math.max(MIN_RADIUS_M, approachRadiusMetres(trigger, place.radiusM, place)))
      } else {
        plainRequested = true
      }
    }
  }

  // Anything without an approach request wants the place's own circle.
  if (plainRequested || radii.size === 0) radii.add(Math.max(MIN_RADIUS_M, place.radiusM))
  return [...radii].sort((a, b) => a - b)
}

/** The radius a particular trigger asked for, used to match a firing to its region. */
export function radiusForTrigger(
  place: Place,
  trigger: { on: 'arrive' | 'leave'; approachMinutes?: number; approachSpeedKmh?: number; id: string; placeId: string },
): number {
  return trigger.on === 'arrive' && trigger.approachMinutes
    ? Math.max(MIN_RADIUS_M, approachRadiusMetres(trigger, place.radiusM, place))
    : Math.max(MIN_RADIUS_M, place.radiusM)
}
