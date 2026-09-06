import React from 'react'
import { Platform, View, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Button } from './Button'
import { Text } from './Text'
import { Icon } from './Icon'
import { elevation, radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'

interface Props {
  label: string
  onPress: () => void
  /**
   * Why the action is not available yet. Present means disabled — the two cannot disagree,
   * so a button is never dead without saying why.
   */
  blockedReason?: string | null
  busy?: boolean
}

/**
 * The save action, always within reach.
 *
 * A form long enough to need scrolling should not send you back to the top to finish it, and
 * a disabled button with no explanation is a dead end — particularly for someone who is not
 * sure they are using the app correctly. So the reason lives with the button: "Add a time or
 * a place first" is a next step, "Done" greyed out is a puzzle.
 */
export function SaveBar({ label, onPress, blockedReason, busy }: Props) {
  const { colors: c, scheme } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(160)}
      style={[
        styles.wrap,
        elevation(3, scheme),
        {
          paddingBottom: Math.max(insets.bottom, space.lg),
          backgroundColor: Platform.OS === 'android' ? c.surface : 'transparent',
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView
          intensity={40}
          tint={scheme}
          style={[StyleSheet.absoluteFill, { backgroundColor: c.glass }]}
        />
      ) : null}

      <View style={styles.inner}>
        {blockedReason ? (
          <View style={styles.reason}>
            <Icon name="circle" size={15} color={c.warn} />
            <Text variant="caption" style={{ color: c.warn, flex: 1 }}>{blockedReason}</Text>
          </View>
        ) : null}

        <Button
          label={busy ? 'Saving…' : label}
          icon="check"
          size="lg"
          full
          disabled={!!blockedReason || busy}
          onPress={onPress}
        />
      </View>
    </Animated.View>
  )
}

/** Room a screen must leave at the bottom so the bar never covers its last control. */
export const SAVE_BAR_CLEARANCE = 148

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    overflow: 'hidden',
  },
  inner: { paddingHorizontal: space.xl, paddingTop: space.lg, gap: space.sm },
  reason: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
