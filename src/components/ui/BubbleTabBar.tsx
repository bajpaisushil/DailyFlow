import React, { useMemo } from 'react'
import { View, StyleSheet, Platform, useWindowDimensions } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { Text } from './Text'
import { Icon, type IconName } from './Icon'
import { PressableScale } from './PressableScale'
import { Gloss } from './Gloss'
import { elevation, radius, smoothCorner, space, spring } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'

/**
 * A floating bubble navigation bar.
 *
 * A soft gradient bubble springs from tab to tab and the selected icon lifts and swells,
 * so moving around the app feels like nudging something buoyant rather than clicking a
 * segmented control. The bubble runs entirely on the UI thread, so it stays fluid even
 * while a screen is doing work.
 *
 * Every tab keeps its word visible at all times: an icon on its own is ambiguous, and for
 * this audience the label is what carries the meaning.
 */

interface TabDef {
  name: string
  label: string
  icon: IconName
}

/**
 * Typed structurally rather than against react-navigation's own types: expo-router vendors
 * its copy at a private path, so depending on that path would break on any minor upgrade.
 * These are the only fields a tab bar actually needs.
 */
interface NavState {
  index: number
  routes: Array<{ key: string; name: string }>
}

interface NavHelpers {
  emit: (event: {
    type: 'tabPress'
    target: string
    canPreventDefault: true
  }) => { defaultPrevented: boolean }
  navigate: (name: string) => void
}

interface Props {
  state: NavState
  navigation: NavHelpers
  tabs: TabDef[]
  bottomInset: number
}

export function BubbleTabBar({ state, navigation, tabs, bottomInset }: Props) {
  const { colors: c, scheme } = useTheme()
  const { width } = useWindowDimensions()

  const barWidth = width - space.lg * 2
  const slot = barWidth / Math.max(1, tabs.length)
  const bubbleSize = Math.min(slot - space.sm, 74)

  // A single derived value drives the bubble; each tab reads from it rather than owning
  // its own animation, so the whole bar stays in sync with one spring.
  const index = useDerivedValue(
    () => withSpring(state.index, spring.press),
    [state.index],
  )

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: index.value * slot + (slot - bubbleSize) / 2 },
      // A touch of squash as it travels — the "balloon" give.
      { scaleX: interpolate(Math.abs(index.value % 1 - 0.5), [0, 0.5], [1.12, 1]) },
    ],
    width: bubbleSize,
  }))

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: Math.max(bottomInset, space.md), left: space.lg, right: space.lg }]}
    >
      <View style={[styles.bar, elevation(3, scheme), { backgroundColor: Platform.OS === 'android' ? c.surface : 'transparent' }]}>
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={44}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={[StyleSheet.absoluteFill, styles.blur, { backgroundColor: c.glass }]}
          />
        ) : null}

        {/* The travelling bubble sits behind the icons */}
        <Animated.View style={[styles.bubbleHolder, bubbleStyle]}>
          <LinearGradient
            colors={[c.accentFrom, c.accentTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.bubble}
          >
            <Gloss radius={radius.pill} intensity="strong" />
          </LinearGradient>
        </Animated.View>

        <View style={styles.row}>
          {tabs.map((tab, i) => {
            const route = state.routes[i]
            const focused = state.index === i

            return (
              <TabButton
                key={tab.name}
                tab={tab}
                focused={focused}
                width={slot}
                onPress={() => {
                  if (!route) return
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  })
                  if (focused || event.defaultPrevented) return
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  navigation.navigate(route.name)
                }}
              />
            )
          })}
        </View>
      </View>
    </View>
  )
}

function TabButton({
  tab, focused, width, onPress,
}: {
  tab: TabDef
  focused: boolean
  width: number
  onPress: () => void
}) {
  const { colors: c } = useTheme()

  // The selected icon lifts and swells inside the bubble.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: withSpring(focused ? -2 : 0, spring.bouncy) },
      { scale: withSpring(focused ? 1.14 : 1, spring.bouncy) },
    ],
  }))

  const tint = focused ? c.onAccent : c.inkFaint

  return (
    <PressableScale
      onPress={onPress}
      haptic={false}
      depth="sm"
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={tab.label}
      style={[styles.tab, { width }]}
    >
      <Animated.View style={iconStyle}>
        <Icon name={tab.icon} size={22} color={tint} />
      </Animated.View>
      <Text
        variant="label"
        numberOfLines={1}
        style={{ fontSize: 11, color: tint, letterSpacing: -0.1 }}
      >
        {tab.label}
      </Text>
    </PressableScale>
  )
}

const BAR_HEIGHT = 76

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  bar: {
    height: BAR_HEIGHT,
    borderRadius: radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
    ...smoothCorner,
  },
  blur: { borderRadius: radius.pill },
  row: { flexDirection: 'row', alignItems: 'center' },
  bubbleHolder: {
    position: 'absolute',
    height: 62,
    top: (BAR_HEIGHT - 62) / 2,
    left: 0,
  },
  bubble: { flex: 1, borderRadius: radius.pill },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: BAR_HEIGHT,
  },
})
