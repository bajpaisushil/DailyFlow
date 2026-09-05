import React from 'react'
import { ScrollView, View, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  children: React.ReactNode
  scroll?: boolean
  /** Extra bottom room so content clears the floating tab bar. */
  bottomInset?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Page shell. Owns the safe-area maths in one place so no screen has to think about
 * notches or the home indicator.
 */
export function Screen({ children, scroll = true, bottomInset = 96, style }: Props) {
  const insets = useSafeAreaInsets()
  const c = useColors()

  const padding = {
    paddingTop: insets.top + space.md,
    paddingBottom: insets.bottom + bottomInset,
    paddingHorizontal: space.xl,
  }

  if (!scroll) {
    return <View style={[styles.fill, { backgroundColor: c.canvas }, padding, style]}>{children}</View>
  }

  return (
    <ScrollView
      style={[styles.fill, { backgroundColor: c.canvas }]}
      contentContainerStyle={[padding, style]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
