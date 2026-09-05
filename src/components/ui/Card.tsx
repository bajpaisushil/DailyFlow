import React from 'react'
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { elevation, radius, smoothCorner, space } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'
import { Gloss } from './Gloss'

interface Props {
  children: React.ReactNode
  /** `raised` is the default card; `hero` is the gradient "what matters now" surface. */
  tone?: 'raised' | 'flat' | 'hero' | 'inset'
  level?: 0 | 1 | 2 | 3
  padded?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * The surface everything sits on. Depth is the app's main visual device — layered
 * surfaces and soft, large-radius shadows — but it is purely decorative: nothing about
 * understanding the screen depends on reading the elevation.
 */
export function Card({ children, tone = 'raised', level = 1, padded = true, style }: Props) {
  const { colors: c, scheme } = useTheme()

  const base: ViewStyle = {
    borderRadius: radius.card,
    padding: padded ? space.xl : 0,
    overflow: 'hidden',
    ...smoothCorner,
  }

  if (tone === 'hero') {
    return (
      <View style={[base, elevation(3, scheme), style]}>
        <LinearGradient
          colors={[c.heroFrom, c.heroTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Gloss radius={radius.card} />
        <View style={{ padding: padded ? space.xl : 0 }}>{children}</View>
      </View>
    )
  }

  // No borders anywhere. Separation comes from fill and soft shadow, so surfaces read as
  // pillowy objects rather than boxes drawn with lines.
  const toneStyle: ViewStyle =
    tone === 'inset'
      ? { backgroundColor: c.canvasDeep }
      : tone === 'flat'
        ? { backgroundColor: c.surfaceAlt }
        : { backgroundColor: c.surface }

  return (
    <View style={[base, toneStyle, tone === 'raised' ? elevation(level, scheme) : undefined, style]}>
      {children}
    </View>
  )
}
