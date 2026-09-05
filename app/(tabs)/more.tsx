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
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

interface Entry {
  icon: IconName
  label: string
  help: string
  href: string
}

/**
 * "More" holds the things that are powerful but not needed daily. Reminders live here
 * rather than in the tab bar: most people never need to build one by hand, because day
 * plans generate them.
 */
const ENTRIES: Entry[] = [
  { icon: 'bell', label: S.reminder.title, help: S.reminder.help, href: '/reminders' },
  { icon: 'metro', label: S.way.title, help: 'Use your travel time well.', href: '/commute' },
  { icon: 'history', label: S.settings.whatHappened, help: S.settings.whatHappenedHelp, href: '/history' },
  { icon: 'space', label: S.settings.spaceUsed, help: S.settings.spaceUsedHelp, href: '/storage' },
  { icon: 'settings', label: S.settings.title, help: S.settings.privacy, href: '/settings' },
]

export default function MoreScreen() {
  const router = useRouter()
  const c = useColors()

  return (
    <Screen>
      <ScreenHeader title={S.nav.more} />

      {ENTRIES.map((e, i) => (
        <Animated.View key={e.href} entering={FadeInDown.delay(Math.min(i, 5) * 28).springify().damping(18).stiffness(140)}>
          <PressableScale onPress={() => router.push(e.href as never)} depth="sm">
            <Card style={styles.card}>
              <IconBadge name={e.icon} />
              <View style={styles.text}>
                <Text variant="heading">{e.label}</Text>
                <Text variant="caption" tone="muted" numberOfLines={2}>{e.help}</Text>
              </View>
              <Icon name="forward" size={20} color={c.inkFaint} />
            </Card>
          </PressableScale>
        </Animated.View>
      ))}

      {/* The privacy promise is stated plainly, on a screen people actually visit. */}
      <Card tone="flat" style={{ marginTop: space.lg }}>
        <View style={styles.privacyRow}>
          <Icon name="lock" size={18} color={c.good} />
          <Text variant="label" tone="good">{S.settings.worksOffline}</Text>
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
          {S.settings.privacyBody}
        </Text>
      </Card>
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  text: { flex: 1, gap: 2 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
