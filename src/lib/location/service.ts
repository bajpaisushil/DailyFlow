import * as Location from 'expo-location'
import type { Place } from '@/lib/types'
import { distanceMetres } from '@/lib/places'

/**
 * Location services.
 *
 * Unlike the web — where the spec forbids position updates to a non-visible document —
 * a native app can genuinely watch places in the background. We still treat that as a
 * privilege the user grants explicitly, never as an assumption, and every screen shows the
 * real, current permission state rather than what we hope it is (REQUIREMENTS.md #36).
 *
 * Battery discipline (#37): we never run a continuous high-accuracy watch. Geofencing is
 * handed to the OS, which uses hardware-assisted, low-power region monitoring instead of
 * keeping the GPS chip awake.
 */

export interface Fix {
  lat: number
  lon: number
  accuracyM: number
  at: number
}

export type PermissionState = 'granted' | 'denied' | 'undetermined'

export interface LocationCapability {
  foreground: PermissionState
  background: PermissionState
  servicesEnabled: boolean
}

export async function readCapability(): Promise<LocationCapability> {
  const [fg, bg, enabled] = await Promise.all([
    Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync().catch(() => ({ status: 'undetermined' as const })),
    Location.hasServicesEnabledAsync().catch(() => false),
  ])
  return {
    foreground: normalise(fg.status),
    background: normalise((bg as { status: string }).status),
    servicesEnabled: enabled,
  }
}

function normalise(status: string): PermissionState {
  if (status === 'granted') return 'granted'
  if (status === 'denied') return 'denied'
  return 'undetermined'
}

/** Asked only at the moment the user does something that needs it — never on launch. */
export async function requestForeground(): Promise<PermissionState> {
  const res = await Location.requestForegroundPermissionsAsync()
  return normalise(res.status)
}

/**
 * Background permission must be requested separately and only after foreground is granted;
 * both Android and iOS reject or degrade the prompt otherwise.
 */
export async function requestBackground(): Promise<PermissionState> {
  const fg = await Location.getForegroundPermissionsAsync()
  if (fg.status !== 'granted') return 'denied'
  const res = await Location.requestBackgroundPermissionsAsync()
  return normalise(res.status)
}

/**
 * A single fix for "I am here now". Balanced accuracy is enough to anchor a place and is
 * markedly cheaper than requesting the GPS chip's best effort.
 */
export async function getCurrentFix(highAccuracy = false): Promise<Fix | null> {
  try {
    const pos = await Location.getCurrentPositionAsync({
      accuracy: highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
    })
    return {
      lat: pos.coords.latitude,
      lon: pos.coords.longitude,
      accuracyM: pos.coords.accuracy ?? 50,
      at: pos.timestamp,
    }
  } catch {
    return null
  }
}

/**
 * Which saved place, if any, the fix falls inside.
 *
 * The radius is inflated by the fix's own reported accuracy. A 100m geofence with a 200m
 * accuracy reading cannot honestly be called "inside", so we require the fix to be within
 * `radius` and treat anything beyond `radius + accuracy` as definitively outside — the band
 * between them is "unknown" and never fires a trigger.
 */
export function placeForFix(fix: Fix, places: Place[]): { place: Place; certain: boolean } | null {
  let best: { place: Place; distance: number } | null = null
  for (const p of places) {
    const d = distanceMetres(fix, { lat: p.lat, lon: p.lon })
    if (d <= p.radiusM + fix.accuracyM && (!best || d < best.distance)) {
      best = { place: p, distance: d }
    }
  }
  if (!best) return null
  return { place: best.place, certain: best.distance <= best.place.radiusM }
}
