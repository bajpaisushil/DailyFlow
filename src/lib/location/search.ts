import * as Location from 'expo-location'

/**
 * Finding a place by name or address.
 *
 * Uses the operating system's own geocoder, which means no API key, no account and no
 * third-party service of ours in the path. The lookup itself is the one part of DailyFlow
 * that touches the network — it is the OS making the request, on demand, only when the user
 * types a search. Nothing about the user's saved places is ever sent anywhere.
 *
 * `getCurrentFix` in ./service.ts remains the offline path and stays the default: GPS needs
 * no network at all.
 */

export interface FoundPlace {
  lat: number
  lon: number
  /** A short human name for the result, best-effort from the OS's address parts. */
  label: string
  /** The fuller address, shown as secondary text so the user can tell results apart. */
  detail?: string
}

/**
 * Look up an address or place name. Returns an empty list rather than throwing: no network,
 * no geocoder on the device, and no matches are all the same thing to the user — "nothing
 * found" — and none of them should surface as an error.
 */
export async function searchPlaces(query: string): Promise<FoundPlace[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  try {
    const results = await Location.geocodeAsync(trimmed)
    if (results.length === 0) return []

    // The geocoder returns coordinates only, so ask it back for the addresses in parallel.
    const described = await Promise.all(
      results.slice(0, 6).map(async (r) => {
        const address = await describe(r.latitude, r.longitude)
        return {
          lat: r.latitude,
          lon: r.longitude,
          label: address?.label ?? trimmed,
          detail: address?.detail,
        }
      }),
    )
    return described
  } catch {
    return []
  }
}

interface Described {
  label: string
  detail?: string
}

/**
 * Turn coordinates into something a person recognises. Used both for search results and to
 * suggest a name after "I am here now", so most users never have to type at all.
 */
export async function describe(lat: number, lon: number): Promise<Described | null> {
  try {
    const [first] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon })
    if (!first) return null

    // Prefer the most specific name the OS gives us, falling back outward.
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
