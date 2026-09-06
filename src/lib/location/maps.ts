import { Platform } from 'react-native'

/**
 * Whether a map can be shown.
 *
 * The map is now OpenStreetMap tiles inside a WebView, so there is no native module, no API
 * key, no account and no billing — it works in every build, including Expo Go.
 *
 * It replaced the native Google/Apple map for a hard reason as well as a cost one: the
 * Android Maps SDK does not degrade without a key, it takes the whole process down, and that
 * crash is native so no React error boundary can catch it. A keyless build was therefore
 * actively dangerous rather than merely limited.
 *
 * The map remains an enhancement: a place can always be set with "I am here now" (GPS, no
 * network at all) or by searching for it.
 */
export function mapsAvailable(): boolean {
  return Platform.OS !== 'web'
}

/** Kept so call sites need not change; there is no key to configure any more. */
export function mapsKeyConfigured(): boolean {
  return true
}
