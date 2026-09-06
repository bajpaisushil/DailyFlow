import * as Location from 'expo-location'

/**
 * Finding a place by name or address.
 *
 * PRIVACY — the one and only network request in DailyFlow.
 *
 * Everything else in this app is on-device. Place search cannot be: turning "sikanderpur"
 * into coordinates requires a map of the world, which no phone carries. So when — and only
 * when — the user types into the place search, those words are sent to a lookup service.
 * Nothing accompanies them: no identifier, no saved places, no history, no reminders. The
 * app never calls out at any other time, and `getCurrentFix` (GPS) needs no network at all.
 *
 * This is stated to the user in plain words on the search field and in Settings. It would
 * have been easy to keep the old "nothing ever leaves your phone" line and quietly add a
 * request; that would have been a lie.
 *
 * Why not the OS geocoder alone: `Location.geocodeAsync` resolves ADDRESSES, not place names.
 * It returns nothing at all for "sikanderpur" — no city, no state, nothing to match — which
 * is most of what people actually type. It is kept as a fallback because it works for full
 * postal addresses and involves no third party of ours.
 */

export interface FoundPlace {
  lat: number
  lon: number
  /** A short human name for the result. */
  label: string
  /** The fuller address, so similar names can be told apart. */
  detail?: string
}

/** Photon: OpenStreetMap search, no API key, no account, no tracking identifiers. */
const SEARCH_ENDPOINT = 'https://photon.komoot.io/api/'
const TIMEOUT_MS = 8000

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] }
  properties?: Record<string, string | undefined>
}

/**
 * Look up a place by name or address.
 *
 * `near` biases results towards the user, which matters enormously: "sikanderpur" matches
 * five different villages across India, and the one they mean is almost always the nearest.
 */
export async function searchPlaces(
  query: string,
  near?: { lat: number; lon: number } | null,
): Promise<FoundPlace[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const online = await searchOnline(trimmed, near)
  if (online.length > 0) return online

  // Full postal addresses still resolve through the OS, and that path involves no service
  // of ours, so it is worth trying before giving up.
  return searchWithOsGeocoder(trimmed)
}

async function searchOnline(
  query: string,
  near?: { lat: number; lon: number } | null,
): Promise<FoundPlace[]> {
  const params = new URLSearchParams({ q: query, limit: '8' })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lon))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) return []

    const body = (await response.json()) as { features?: PhotonFeature[] }
    return (body.features ?? [])
      .map(toFoundPlace)
      .filter((p): p is FoundPlace => p !== null)
  } catch {
    // Offline, blocked, or slow. The caller falls back to the OS geocoder and then says
    // "nothing found" — never an error, because from the user's side they are the same thing.
    return []
  } finally {
    clearTimeout(timer)
  }
}

function toFoundPlace(feature: PhotonFeature): FoundPlace | null {
  const coords = feature.geometry?.coordinates
  if (!coords || coords.length < 2) return null
  const [lon, lat] = coords
  if (typeof lat !== 'number' || typeof lon !== 'number') return null

  const p = feature.properties ?? {}
  const label = p.name ?? p.street ?? p.city ?? p.state ?? 'This place'

  // Build the second line out of whatever the result actually has, widest last, so two
  // results with the same name are distinguishable by where they are.
  const detail = [p.street, p.district, p.city, p.county, p.state, p.country]
    .filter((part): part is string => !!part && part !== label)
    .filter((part, i, all) => all.indexOf(part) === i)
    .slice(0, 3)
    .join(', ')

  return { lat, lon, label, detail: detail || undefined }
}

async function searchWithOsGeocoder(query: string): Promise<FoundPlace[]> {
  try {
    const results = await Location.geocodeAsync(query)
    if (results.length === 0) return []
    return Promise.all(
      results.slice(0, 6).map(async (r) => {
        const address = await describe(r.latitude, r.longitude)
        return {
          lat: r.latitude,
          lon: r.longitude,
          label: address?.label ?? query,
          detail: address?.detail,
        }
      }),
    )
  } catch {
    return []
  }
}

interface Described {
  label: string
  detail?: string
}

/**
 * Turn coordinates into something a person recognises. Runs on the device's own geocoder,
 * so naming a place you are standing in needs no third party at all.
 */
export async function describe(lat: number, lon: number): Promise<Described | null> {
  try {
    const [first] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
    if (!first) return null

    const label = first.name ?? first.street ?? first.district ?? first.city ?? 'This place'
    const detail = [first.street, first.district, first.city, first.region]
      .filter((part): part is string => !!part && part !== label)
      .slice(0, 3)
      .join(', ')

    return { label, detail: detail || undefined }
  } catch {
    return null
  }
}
