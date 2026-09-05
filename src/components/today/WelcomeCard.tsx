import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Ellipse } from 'react-native-svg'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Button } from '@/components/ui/Button'
import { PressableScale } from '@/components/ui/PressableScale'
import { Icon } from '@/components/ui/Icon'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * First run.
 *
 * Deliberately a card on Today rather than a blocking walkthrough: the app must be useful
 * the moment it opens (REQUIREMENTS.md #47), so nothing stands between the user and their
 * lists. This explains what DailyFlow is, states the privacy promise plainly, offers one
 * obvious next step, and gets out of the way for good once dismissed.
 */
interface Props {
  onDismiss: () => void
}

export function WelcomeCard({ onDismiss }: Props) {
  const router = useRouter()
  const c = useColors()

  return (
    <Animated.View entering={FadeIn.duration(320)}>
      <Card tone="hero" style={{ marginBottom: space.lg }}>
        <OrbitMark color={c.onAccent} />

        <Text variant="title" style={{ color: c.onAccent, marginTop: space.lg }}>
          {S.welcome.hello}
        </Text>
        <Text variant="body" style={{ color: c.onAccent, opacity: 0.9, marginTop: space.xs }}>
          {S.welcome.line1}
        </Text>

        <View style={styles.promise}>
          <Icon name="lock" size={17} color={c.onAccent} />
          <Text variant="caption" style={{ color: c.onAccent, opacity: 0.9, flex: 1 }}>
            {S.welcome.line2}
          </Text>
        </View>

        <Button
          label={S.plan.addOne}
          icon="plus"
          variant="secondary"
          full
          style={{ marginTop: space.lg }}
          onPress={() => {
            onDismiss()
            router.push('/plan/new')
          }}
        />

        <PressableScale
          onPress={onDismiss}
          haptic={false}
          style={styles.later}
          accessibilityRole="button"
          accessibilityLabel={S.welcome.later}
        >
          <Text variant="label" style={{ color: c.onAccent, opacity: 0.75 }}>
            {S.welcome.later}
          </Text>
        </PressableScale>
      </Card>
    </Animated.View>
  )
}

/** The Orbit mark, drawn inline so the brand appears without shipping another image. */
function OrbitMark({ color }: { color: string }) {
  return (
    <Svg width={54} height={54} viewBox="0 0 100 100">
      <Ellipse
        cx="50" cy="50" rx="35" ry="15"
        stroke={color} strokeWidth={7.5} fill="none"
        opacity={0.62} transform="rotate(-28 50 50)"
      />
      <Circle cx="50" cy="50" r="12.5" fill={color} />
    </Svg>
  )
}

const styles = StyleSheet.create({
  promise: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    marginTop: space.md,
  },
  later: { alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
})
