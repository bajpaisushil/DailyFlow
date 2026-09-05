import React from 'react'
import { View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { PressableScale } from './PressableScale'
import { Text } from './Text'
import { Icon, type IconName } from './Icon'
import { elevation, radius, smoothCorner, space, TAP } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'
import { Gloss } from './Gloss'

interface Props {
  label: string
  onPress?: () => void
  icon?: IconName
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger'
  size?: 'md' | 'lg'
  full?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}

/**
 * Buttons always carry a word. An icon may accompany it but never replaces it.
 * The primary variant uses the accent gradient — the app's one moment of colour.
 */
export function Button({
  label, onPress, icon, variant = 'primary', size = 'md', full, disabled, style,
}: Props) {
  const { colors: c, scheme } = useTheme()
  const height = size === 'lg' ? 58 : TAP
  const isPrimary = variant === 'primary'

  const inner = (
    <View style={styles.row}>
      {icon ? (
        <Icon
          name={icon}
          size={20}
          color={isPrimary ? c.onAccent : variant === 'danger' ? c.bad : c.ink}
        />
      ) : null}
      <Text
        variant="label"
        style={{
          fontSize: size === 'lg' ? 18 : 16,
          color: isPrimary ? c.onAccent : variant === 'danger' ? c.bad : c.ink,
        }}
      >
        {label}
      </Text>
    </View>
  )

  const shell: ViewStyle = {
    height,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
    alignSelf: full ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.45 : 1,
    overflow: 'hidden',
    ...smoothCorner,
  }

  if (isPrimary) {
    return (
      <PressableScale
        onPress={disabled ? undefined : onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled }}
        style={[shell, elevation(2, scheme), style]}
      >
        <LinearGradient
          colors={[c.accentFrom, c.accentTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Gloss radius={radius.pill} intensity="strong" />
        {inner}
      </PressableScale>
    )
  }

  const fill: ViewStyle =
    variant === 'secondary'
      ? { backgroundColor: c.surface }
      : variant === 'danger'
        ? { backgroundColor: c.badSoft }
        : { backgroundColor: 'transparent' }

  return (
    <PressableScale
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={[shell, fill, variant === 'secondary' ? elevation(1, scheme) : undefined, style]}
    >
      {inner}
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
