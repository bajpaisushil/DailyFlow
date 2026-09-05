import { Platform } from 'react-native'
import { isExpoGo } from '@/lib/runtime'

/**
 * Map support, loaded lazily.
 *
 * expo-maps is a native module and is not present in Expo Go, so importing it eagerly would
 * throw during module evaluation and take down every screen that reaches it — exactly the
 * failure the notification scheduler already taught us. It is resolved on demand behind a
 * try/catch, and the place editor falls back to search and GPS when it is unavailable.
 *
 * On Android the map needs a Google Maps API key in app.json; without one the view renders
 * blank rather than erroring, which is why `mapsAvailable()` is only ever used to decide
 * whether to OFFER the map, never to promise it works.
 */

type MapsModule = typeof import('expo-maps')

let cached: MapsModule | null | undefined

export function loadMaps(): MapsModule | null {
  if (cached !== undefined) return cached
  if (isExpoGo || Platform.OS === 'web') {
    cached = null
    return null
  }
  try {
    // Deliberately require(), not import: this must be able to fail without unwinding the
    // module graph.
    cached = require('expo-maps') as MapsModule
  } catch {
    cached = null
  }
  return cached
}

export function mapsAvailable(): boolean {
  return loadMaps() != null
}
