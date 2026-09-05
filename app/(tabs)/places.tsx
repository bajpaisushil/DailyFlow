import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { EmptyState } from '@/components/ui/EmptyState'
import { PermissionCard } from '@/components/ui/PermissionCard'
import { useCapabilities } from '@/hooks/useCapabilities'
import { EXPO_GO_LIMITATION, supportsBackgroundGeofencing } from '@/lib/runtime'
import { useData } from '@/stores/data'
import { describeRadius } from '@/lib/places'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/** Places the user goes often. Arrival and departure can trigger reminders. */
export default function PlacesScreen() {
  const router = useRouter()
  const c = useColors()
  const places = useData((s) => s.places)
  const { caps, askForPlaces, openPhoneSettings } = useCapabilities()

  // Only ask once the user actually has a place to watch — the permission is meaningless
  // before that, and asking early is exactly the aggression we promised to avoid.
  const needsPlacePermission =
    supportsBackgroundGeofencing &&
    places.length > 0 &&
    !caps.placesWorkWhenClosed &&
    caps.location.background !== 'granted'

  return (
    <Screen>
      <ScreenHeader
        title={S.nav.places}
        help={S.place.help}
        onAdd={() => router.push('/place/new')}
        addLabel={S.place.addOne}
      />

      {/* Expo Go genuinely cannot watch places in the background. Say so plainly rather
          than offering a permission that would not help. */}
      {!supportsBackgroundGeofencing && places.length > 0 ? (
        <Card tone="flat" style={{ marginBottom: space.lg }}>
          <View style={styles.notice}>
            <Icon name="phoneOff" size={19} color={c.warn} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {EXPO_GO_LIMITATION}
            </Text>
          </View>
        </Card>
      ) : null}

      {needsPlacePermission ? (
        <PermissionCard
          kind="places"
          state={caps.location.background === 'denied' ? 'denied' : 'undetermined'}
          onAsk={() => void askForPlaces()}
          onOpenSettings={openPhoneSettings}
        />
      ) : null}

      {places.length === 0 ? (
        <EmptyState
          icon="place"
          title={S.place.empty}
          help={S.place.emptyHelp}
          actionLabel={S.place.addOne}
          onAction={() => router.push('/place/new')}
        />
      ) : (
        places.map((place, i) => (
          <Animated.View key={place.id} entering={FadeInDown.delay(Math.min(i, 5) * 28).springify().damping(18).stiffness(140)}>
            <PressableScale onPress={() => router.push(`/place/${place.id}`)} depth="sm">
              <Card style={styles.card}>
                <IconBadge name={(place.icon as IconName) ?? 'place'} />
                <View style={styles.text}>
                  <Text variant="heading">{place.name}</Text>
                  <Text variant="caption" tone="muted">{describeRadius(place.radiusM)}</Text>
                </View>
                <Icon name="forward" size={20} color={c.inkFaint} />
              </Card>
            </PressableScale>
          </Animated.View>
        ))
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  text: { flex: 1, gap: 2 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md },
})
