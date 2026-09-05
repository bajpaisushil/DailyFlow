import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Text } from './Text'
import { Icon } from './Icon'
import { PressableScale } from './PressableScale'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

interface Props {
  title: string
  onDone?: () => void
  doneLabel?: string
  disabled?: boolean
}

/**
 * Header for editor screens. "Go back" is always a word, never a bare arrow, and the
 * confirming action is always called "Done" — one word for one thing, everywhere.
 */
export function DetailHeader({ title, onDone, doneLabel, disabled }: Props) {
  const router = useRouter()
  const c = useColors()

  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        <PressableScale
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={S.action.goBack}
          style={styles.back}
        >
          <Icon name="back" size={22} color={c.ink} />
          <Text variant="label">{S.action.goBack}</Text>
        </PressableScale>

        {onDone ? (
          <PressableScale
            onPress={disabled ? undefined : onDone}
            accessibilityRole="button"
            accessibilityLabel={doneLabel ?? S.action.done}
            style={[
              styles.done,
              { backgroundColor: disabled ? c.canvasDeep : c.accent, opacity: disabled ? 0.6 : 1 },
            ]}
          >
            <Text variant="label" style={{ color: disabled ? c.inkFaint : c.onAccent }}>
              {doneLabel ?? S.action.done}
            </Text>
          </PressableScale>
        ) : null}
      </View>

      <Text variant="display" style={{ marginTop: space.lg }}>{title}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xl },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingRight: space.md },
  done: {
    paddingHorizontal: space.xl,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
