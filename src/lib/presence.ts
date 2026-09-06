import type { ActivityEvent, Place } from '@/lib/types'

/**
 * Where the user is right now, derived from the arrivals and departures the geofence already
 * records. No extra tracking, no extra battery: the events exist, they were simply never read.
 *
 * This is what makes Today context-aware rather than merely scheduled. Standing inside the
 * temple while the home screen still says "leave for temple" is the app failing at the one
 * thing it is for — knowing what is happening now.
 */

/** An arrival older than this is not trusted: the user may have left with the app closed. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000

export interface Presence {
  place: Place
  since: number
}

/**
 * The place the user is currently inside, if any.
 *
 * Walks the log newest-first and takes the first conclusive event per place: an arrival with
 * no later departure means they are still there.
 */
export function currentPlace(
  events: ActivityEvent[],
  places: Place[],
  now: number = Date.now(),
): Presence | null {
  const decided = new Set<string>()

  // The log is stored newest-first, so the first event for a place is the latest one.
  for (const event of events) {
    if (event.kind !== 'place.entered' && event.kind !== 'place.exited') continue
    const placeId = event.placeId
    if (!placeId || decided.has(placeId)) continue
    decided.add(placeId)

    if (event.kind !== 'place.entered') continue
    if (now - event.at > STALE_AFTER_MS) continue

    const place = places.find((p) => p.id === placeId && p.deletedAt == null)
    if (place) return { place, since: event.at }
  }

  return null
}

/** "You are at the Temple" — the line Today shows when it knows where you are. */
export function describePresence(presence: Presence): string {
  return `You are at ${presence.place.name}`
}

/**
 * Is this entry about going somewhere the user has already got to?
 *
 * Used to stop Today urging someone to leave for a place they are standing in.
 */
export function alreadyThere(
  presence: Presence | null,
  destinationPlaceId: string | undefined,
): boolean {
  if (!presence || !destinationPlaceId) return false
  return presence.place.id === destinationPlaceId
}
