import React from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Card } from './Card'
import { Text } from './Text'
import { IconBadge, type IconName } from './Icon'
import { Button } from './Button'
import { PressableScale } from './PressableScale'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * A permission ask, shown only where and when the permission is actually needed —
 * never on launch, and never twice after a refusal (REQUIREMENTS.md #30).
 *
 * It always explains *why* in plain words, always offers a way to decline that does not
 * feel like failure, and when the answer is a hard no it points at phone settings rather
 * than nagging.
 */
interface Props {
  kind: 'reminders' | 'places'
  /** 'undetermined' → we may ask. 'denied' → only phone settings can fix it. */
  state: 'undetermined' | 'denied'
  onAsk: () => void
  onOpenSettings: () => void
  onDismiss?: () => void
}

export function PermissionCard({ kind, state, onAsk, onOpenSettings, onDismiss }: Props) {
  const c = useColors()

  const copy =
    kind === 'reminders'
      ? {
          icon: 'bell' as IconName,
          title: S.allow.remindersTitle,
          body: S.allow.remindersBody,
          yes: S.allow.remindersYes,
        }
      : {
          icon: 'place' as IconName,
          title: S.allow.placesTitle,
          body: S.allow.placesBody,
          yes: S.allow.placesYes,
        }

  const blocked = state === 'denied'

  return (
    <Animated.View entering={FadeIn.duration(260)}>
      <Card style={{ marginBottom: space.lg }}>
        <View style={styles.head}>
          <IconBadge name={copy.icon} plate={48} size={23} />
          <Text variant="heading" style={{ flex: 1 }}>
            {blocked ? S.allow.blockedTitle : copy.title}
          </Text>
        </View>

        <Text variant="caption" tone="muted" style={{ marginTop: space.md }}>
          {blocked ? S.allow.blockedBody : copy.body}
        </Text>

        <Button
          label={blocked ? S.allow.openSettings : copy.yes}
          icon={blocked ? 'settings' : copy.icon}
          full
          size="lg"
          style={{ marginTop: space.lg }}
          onPress={blocked ? onOpenSettings : onAsk}
        />

        {onDismiss ? (
          <PressableScale
            onPress={onDismiss}
            haptic={false}
            style={styles.dismiss}
            accessibilityRole="button"
            accessibilityLabel={S.action.notNow}
          >
            <Text variant="label" tone="faint">{S.action.notNow}</Text>
          </PressableScale>
        ) : null}
      </Card>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dismiss: { alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
})
