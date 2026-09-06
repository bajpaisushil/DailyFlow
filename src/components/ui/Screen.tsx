import React from 'react'
import {
  KeyboardAvoidingView, Platform, ScrollView, View, StyleSheet,
  type ViewStyle, type StyleProp,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  children: React.ReactNode
  scroll?: boolean
  /** Extra bottom room so content clears the tab bar or a save bar. */
  bottomInset?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Page shell. Owns the safe-area maths and keyboard avoidance in one place, so no screen has
 * to think about notches, home indicators, or the keyboard covering what is being typed.
 *
 * The keyboard handling is not optional polish: without it, tapping a field near the bottom
 * of a long form scrolled the page as far as it could go and left the field underneath the
 * keyboard, with no way to see what was being typed.
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
    <KeyboardAvoidingView
      style={styles.fill}
      // iOS needs padding; on Android the window resizes itself, and 'padding' there fights
      // the resize and leaves a gap.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
    >
      <ScrollView
        style={[styles.fill, { backgroundColor: c.canvas }]}
        contentContainerStyle={[padding, style]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Scrolls the focused field into view instead of leaving it under the keyboard.
        automaticallyAdjustKeyboardInsets
        // Dragging the page down puts the keyboard away, which is what people try first.
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({ fill: { flex: 1 } })
