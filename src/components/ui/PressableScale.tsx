import React, { useCallback } from 'react'
import { Pressable, type PressableProps, type ViewStyle, type StyleProp } from 'react-native'
import * as Haptics from 'expo-haptics'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { spring, TAP } from '@/theme/tokens'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>
  /** How far it presses in. Large surfaces need less travel than small chips. */
  depth?: 'sm' | 'md' | 'lg'
  haptic?: boolean
  children?: React.ReactNode
}

// A pronounced squash — the surface should visibly give under a finger.
const SCALE = { sm: 0.97, md: 0.945, lg: 0.915 } as const

/**
 * The tactile press used across the app. Scale runs on the UI thread through Reanimated,
 * so it stays smooth even while the JS thread is busy — which is the whole reason we use
 * Reanimated rather than RN's Animated here.
 *
 * Every instance is at least 48pt so it clears the comfortable-touch threshold.
 */
export function PressableScale({
  style, depth = 'md', haptic = true, onPressIn, onPressOut, onPress, children, ...rest
}: Props) {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - pressed.value * (1 - SCALE[depth]) },
    ],
    opacity: 1 - pressed.value * 0.04,
  }))

  const handleIn = useCallback<NonNullable<PressableProps['onPressIn']>>(
    (e) => {
      pressed.value = withSpring(1, spring.press)
      onPressIn?.(e)
    },
    [pressed, onPressIn],
  )

  const handleOut = useCallback<NonNullable<PressableProps['onPressOut']>>(
    (e) => {
      pressed.value = withSpring(0, spring.press)
      onPressOut?.(e)
    },
    [pressed, onPressOut],
  )

  const handlePress = useCallback<NonNullable<PressableProps['onPress']>>(
    (e) => {
      if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      onPress?.(e)
    },
    [haptic, onPress],
  )

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={handleIn}
      onPressOut={handleOut}
      onPress={handlePress}
      style={[{ minHeight: TAP }, style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  )
}
