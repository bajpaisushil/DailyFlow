import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Card } from './Card'
import { Text } from './Text'
import { IconBadge, type IconName } from './Icon'
import { Button } from './Button'
import { space } from '@/theme/tokens'

interface Props {
  icon: IconName
  title: string
  help: string
  actionLabel?: string
  onAction?: () => void
}

/** Empty states are invitations, never errors — and always offer the next step. */
export function EmptyState({ icon, title, help, actionLabel, onAction }: Props) {
  return (
    <Card style={styles.wrap}>
      <IconBadge name={icon} plate={60} size={28} />
      <Text variant="heading" center style={{ marginTop: space.lg }}>{title}</Text>
      <Text variant="caption" tone="muted" center style={styles.help}>{help}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} icon="plus" onPress={onAction} style={{ marginTop: space.xl }} />
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: space['3xl'] },
  help: { marginTop: space.xs, maxWidth: 280 },
})
