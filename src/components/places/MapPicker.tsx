import React, { useMemo } from 'react'
import { Platform, View, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/Text'
import { loadMaps } from '@/lib/location/maps'
import { radius, smoothCorner, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  lat: number
  lon: number
  /** Fired when the user taps a new spot on the map. */
  onPick: (lat: number, lon: number) => void
  height?: number
}

/**
 * An inline map for adjusting exactly where a place sits.
 *
 * Tapping the map moves the pin — deliberately the only interaction, because dragging a
 * marker is a fiddly gesture and this app is built for people who find that hard.
 *
 * Renders nothing when maps are unavailable (Expo Go, web); the place editor keeps working
 * through "I am here now" and search, so the map is always an enhancement, never a
 * requirement, and the app stays fully usable offline.
 */
export function MapPicker({ lat, lon, onPick, height = 260 }: Props) {
  const c = useColors()
  const maps = loadMaps()

  const camera = useMemo(
    () => ({ coordinates: { latitude: lat, longitude: lon }, zoom: 16 }),
    [lat, lon],
  )

  const markers = useMemo(
    () => [{ coordinates: { latitude: lat, longitude: lon } }],
    [lat, lon],
  )

  if (!maps) return null

  // Apple Maps on iOS needs no key; Google Maps on Android needs one in app.json. Both
  // expose the same click shape, so the handler is shared.
  const handleClick = (event: { coordinates: { latitude?: number; longitude?: number } }) => {
    const { latitude, longitude } = event.coordinates
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      onPick(latitude, longitude)
    }
  }

  return (
    <View style={[styles.shell, { height, backgroundColor: c.canvasDeep }]}>
      {Platform.OS === 'ios' ? (
        <maps.AppleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={camera}
          markers={markers}
          onMapClick={handleClick}
        />
      ) : (
        <maps.GoogleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={camera}
          markers={markers}
          onMapClick={handleClick}
        />
      )}

      <View style={[styles.hint, { backgroundColor: c.surface }]} pointerEvents="none">
        <Text variant="caption" tone="muted">Tap the map to move the pin</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: radius.card,
    overflow: 'hidden',
    marginBottom: space.lg,
    ...smoothCorner,
  },
  hint: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    bottom: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
})
