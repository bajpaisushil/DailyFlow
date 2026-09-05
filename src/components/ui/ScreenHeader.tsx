import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from './Text'
import { PressableScale } from './PressableScale'
import { Icon } from './Icon'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  title: string
  help?: string
  onAdd?: () => void
  addLabel?: string
}

export function ScreenHeader({ title, help, onAdd, addLabel }: Props) {
  const c = useColors()
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text variant="display" style={{ flex: 1 }}>{title}</Text>
        {onAdd ? (
          <PressableScale
            onPress={onAdd}
            accessibilityRole="button"
            accessibilityLabel={addLabel ?? 'Add'}
            style={[styles.add, { backgroundColor: c.accentSoft }]}
          >
            <Icon name="plus" size={26} color={c.accent} />
          </PressableScale>
        ) : null}
      </View>
      {help ? (
        <Text variant="caption" tone="muted" style={{ marginTop: space.xs }}>{help}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: space.xl },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  add: {
    width: 48, height: 48, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
})
