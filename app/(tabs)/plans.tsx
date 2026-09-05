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
import { useData } from '@/stores/data'
import { useSettings } from '@/stores/settings'
import { describeDays, formatTime } from '@/lib/time'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/** Day plans (routines): the things the user does again and again. */
export default function PlansScreen() {
  const router = useRouter()
  const c = useColors()
  const routines = useData((s) => s.routines)
  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)

  return (
    <Screen>
      <ScreenHeader
        title={S.nav.dayPlans}
        help={S.plan.help}
        onAdd={() => router.push('/plan/new')}
        addLabel={S.plan.addOne}
      />

      {routines.length === 0 ? (
        <EmptyState
          icon="repeat"
          title={S.plan.empty}
          help={S.plan.emptyHelp}
          actionLabel={S.plan.addOne}
          onAction={() => router.push('/plan/new')}
        />
      ) : (
        routines.map((r, i) => (
          <Animated.View key={r.id} entering={FadeInDown.delay(i * 40).duration(300)}>
            <PressableScale onPress={() => router.push(`/plan/${r.id}`)} depth="sm">
              <Card style={[styles.card, !r.enabled && { opacity: 0.55 }]}>
                <IconBadge name={(r.icon as IconName) ?? 'repeat'} />
                <View style={styles.text}>
                  <Text variant="heading">{r.name}</Text>
                  <Text variant="caption" tone="muted">
                    {describeDays(r.days, locale)} · {formatTime(r.startTime, use24h, locale)}
                  </Text>
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
})
