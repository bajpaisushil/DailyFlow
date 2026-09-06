import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from './Text'
import { Icon } from './Icon'
import { radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * The honesty device (REQUIREMENTS.md #34/#36).
 *
 * Every reminder shows, in plain words, whether it can actually reach the user. The app must
 * never present a reminder as scheduled when the phone will not deliver it. Computed at
 * runtime from the real permission state, never assumed.
 */
export type Reach =
  /** OS will deliver it with the app fully closed. */
  | 'closed'
  /** Only while DailyFlow is open — e.g. permission for background location was refused. */
  | 'openOnly'
  /** The user has not granted the permission this reminder needs yet. */
  | 'needsAllow'
  /** The user switched it off. */
  | 'off'
  /** This build cannot do it at all — Expo Go. Not the user's doing, and not fixable here. */
  | 'unavailable'

interface Props {
  reach: Reach
  compact?: boolean
}

export function CapabilityBadge({ reach, compact }: Props) {
  const c = useColors()

  const config = {
    closed: { bg: c.goodSoft, fg: c.good, icon: 'checkCircle' as const, text: S.can.closed },
    openOnly: { bg: c.warnSoft, fg: c.warn, icon: 'phoneOff' as const, text: S.can.openOnly },
    needsAllow: { bg: c.accentSoft, fg: c.accent, icon: 'lock' as const, text: S.can.needsAllow },
    off: { bg: c.canvasDeep, fg: c.inkFaint, icon: 'bellOff' as const, text: S.can.off },
    // Distinguished from 'off' on purpose: "turned off" invites the user to go looking for a
    // switch that does not exist, and wastes their time before they conclude the app is broken.
    unavailable: { bg: c.warnSoft, fg: c.warn, icon: 'phoneOff' as const, text: S.can.unavailable },
  }[reach]

  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: config.bg, paddingVertical: compact ? space.xs : space.sm },
      ]}
    >
      <Icon name={config.icon} size={15} color={config.fg} />
      <Text variant="caption" style={{ color: config.fg, flex: 1 }} numberOfLines={2}>
        {config.text}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
})
