import React, { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, TextInput, View, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { searchPlaces, type FoundPlace } from '@/lib/location/search'
import { font, radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  onChoose: (place: FoundPlace) => void
  /** Lifted so the editor can plot every candidate on the map beside the list. */
  onResults?: (places: FoundPlace[]) => void
  /** Which result is currently chosen, so the list can show it as selected. */
  selected?: FoundPlace | null
}

/**
 * Find a place by typing its name — "the temple near the market", a shop, a street.
 *
 * This is the one place in DailyFlow where typing is genuinely the best tool, because the
 * user is naming somewhere they are not currently standing. GPS and the map remain available
 * for everyone else.
 *
 * The lookup is debounced and goes through the operating system's geocoder, so there is no
 * API key and no service of ours in the path.
 */
export function PlaceSearch({ onChoose, onResults, selected }: Props) {
  const c = useColors()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<FoundPlace[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const run = useCallback((text: string) => {
    if (timer.current) clearTimeout(timer.current)
    if (text.trim().length < 3) {
      setResults([])
      onResults?.([])
      setSearched(false)
      return
    }
    // Debounced: the geocoder is a real network call and should not fire per keystroke.
    timer.current = setTimeout(async () => {
      setSearching(true)
      const found = await searchPlaces(text)
      setResults(found)
      onResults?.(found)
      setSearched(true)
      setSearching(false)
    }, 550)
  }, [onResults])

  return (
    <View>
      <Card tone="flat" padded={false} style={styles.field}>
        <Icon name="find" size={20} color={c.inkFaint} />
        <TextInput
          value={query}
          onChangeText={(t) => {
            setQuery(t)
            run(t)
          }}
          placeholder="Search a place or address"
          placeholderTextColor={c.inkFaint}
          style={[styles.input, { color: c.ink }]}
          accessibilityLabel="Search a place or address"
          returnKeyType="search"
          autoCorrect={false}
        />
        {searching ? <ActivityIndicator size="small" color={c.accent} /> : null}
      </Card>

      {results.map((place, i) => (
        <Animated.View key={`${place.lat},${place.lon},${i}`} entering={FadeIn.duration(180)}>
          <PressableScale
            depth="sm"
            onPress={() => onChoose(place)}
            accessibilityRole="button"
            accessibilityLabel={place.label}
            style={[
              styles.result,
              {
                backgroundColor:
                  selected && selected.lat === place.lat && selected.lon === place.lon
                    ? c.accentSoft
                    : c.surfaceAlt,
              },
            ]}
          >
            <Icon name="place" size={19} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="body" numberOfLines={1}>{place.label}</Text>
              {place.detail ? (
                <Text variant="caption" tone="muted" numberOfLines={1}>{place.detail}</Text>
              ) : null}
            </View>
            {/* Selection is carried by a tick as well as by the tint, because the tint alone
                is ~1.1:1 against the surface — well below what a state indicator needs. */}
            {selected && selected.lat === place.lat && selected.lon === place.lon ? (
              <Icon name="checkCircle" size={21} color={c.accent} />
            ) : null}
          </PressableScale>
        </Animated.View>
      ))}

      {searched && !searching && results.length === 0 ? (
        <Text variant="caption" tone="muted" style={{ paddingHorizontal: space.lg }}>
          Nothing found. Check the spelling, or use “I am here now”.
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.sm,
  },
  input: { flex: 1, fontSize: font.base, paddingVertical: space.lg, minHeight: 52 },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    marginBottom: space.xs,
    minHeight: 60,
  },
})
