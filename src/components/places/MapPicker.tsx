import React, { useMemo } from 'react'
import { Platform, View, StyleSheet } from 'react-native'
import { Text } from '@/components/ui/Text'
import { loadMaps } from '@/lib/location/maps'
import { radius, smoothCorner, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

export interface MapMarker {
  lat: number
  lon: number
  title?: string
  /** The one currently chosen; drawn in the accent colour. */
  selected?: boolean
}

interface Props {
  /** Where the camera looks — normally the chosen spot. */
  lat: number
  lon: number
  /** Every candidate to draw. Search results appear here alongside the chosen pin. */
  markers?: MapMarker[]
  /** Fired when the user taps open map, to move the pin there. */
  onPick: (lat: number, lon: number) => void
  height?: number
  hint?: string
}

/**
 * The map for choosing exactly where a place sits.
 *
 * It draws every search result, not just the chosen one, so a list of similar-sounding
 * names ("Shiva Temple") can be told apart by where they actually are — which is the whole
 * reason to show a map at all. Tapping anywhere moves the pin there.
 *
 * Renders nothing when maps are unavailable (Expo Go, web). The place editor keeps working
 * through "I am here now" and search, so the map is always an enhancement, never a
 * requirement, and the app stays fully usable offline.
 */
export function MapPicker({ lat, lon, markers, onPick, height = 280, hint }: Props) {
  const c = useColors()
  const maps = loadMaps()

  const camera = useMemo(
    () => ({ coordinates: { latitude: lat, longitude: lon }, zoom: 15 }),
    [lat, lon],
  )

  const pins = useMemo(() => {
    const list = markers?.length ? markers : [{ lat, lon, selected: true }]
    return list.map((m) => ({
      coordinates: { latitude: m.lat, longitude: m.lon },
      title: m.title,
      tintColor: m.selected ? c.accent : c.inkFaint,
    }))
  }, [markers, lat, lon, c.accent, c.inkFaint])

  if (!maps) return null

  // Apple Maps on iOS needs no key; Google Maps on Android reads one from the environment.
  // Both expose the same click shape, so the handler is shared.
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
          markers={pins}
          onMapClick={handleClick}
        />
      ) : (
        <maps.GoogleMaps.View
          style={StyleSheet.absoluteFill}
          cameraPosition={camera}
          markers={pins}
          onMapClick={handleClick}
        />
      )}

      <View style={[styles.hint, { backgroundColor: c.surface }]} pointerEvents="none">
        <Text variant="caption" tone="muted">
          {hint ?? 'Tap the map to move the pin'}
        </Text>
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
