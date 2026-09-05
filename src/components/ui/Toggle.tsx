import React from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { Text } from './Text'
import { Icon, type IconName } from './Icon'
import { PressableScale } from './PressableScale'
import { space, radius, spring } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  label: string
  help?: string
  icon?: IconName
  value: boolean
  onChange: (next: boolean) => void
}

/**
 * A soft pill switch. The knob springs across with real give, and the whole row is the
 * target — never just the switch, which is a small and unforgiving thing to hit.
 */
export function Toggle({ label, help, icon, value, onChange }: Props) {
  const c = useColors()

  const knob = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(value ? 22 : 0, spring.press) }],
  }))

  return (
    <PressableScale
      depth="sm"
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      style={[styles.row, { backgroundColor: c.surfaceAlt }]}
    >
      {icon ? <Icon name={icon} size={21} color={value ? c.accent : c.inkFaint} /> : null}

      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {help ? <Text variant="caption" tone="muted">{help}</Text> : null}
      </View>

      <View style={[styles.track, { backgroundColor: value ? c.accent : c.lineStrong }]}>
        <Animated.View style={[styles.knob, knob]} />
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderRadius: radius.lg, minHeight: 60,
  },
  track: {
    width: 52, height: 30, borderRadius: radius.pill,
    padding: 3, justifyContent: 'center',
  },
  knob: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
})
