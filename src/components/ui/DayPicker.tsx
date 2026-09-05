import React from 'react'
import { View, StyleSheet } from 'react-native'
import { Text } from './Text'
import { PressableScale } from './PressableScale'
import type { Weekday } from '@/lib/types'
import { ALL_WEEKDAYS, WEEKDAYS_MON_FRI, WEEKEND } from '@/lib/time'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { useSettings } from '@/stores/settings'
import { S } from '@/lib/strings'

interface Props {
  value: Weekday[]
  onChange: (days: Weekday[]) => void
}

/**
 * Days, presets first.
 *
 * Most people finish in one tap on "Every day" / "Work days" / "Weekend"; the seven-column
 * strip below is there for the rest. Each column shows the day's first letter *and* stays a
 * 44pt target, because a strip of tiny letters is exactly the control our audience fails on.
 */
export function DayPicker({ value, onChange }: Props) {
  const c = useColors()
  const locale = useSettings((s) => s.settings.locale)
  const weekStartsOn = useSettings((s) => s.settings.weekStartsOn)

  const selected = new Set(value)

  const presets = [
    { label: S.plan.everyDay, days: ALL_WEEKDAYS },
    { label: S.plan.workDays, days: WEEKDAYS_MON_FRI },
    { label: S.plan.weekend, days: WEEKEND },
  ]

  const matches = (days: Weekday[]) =>
    days.length === selected.size && days.every((d) => selected.has(d))

  // Order the strip by the user's week-start preference rather than always Sunday-first.
  const ordered: Weekday[] = weekStartsOn === 1
    ? [1, 2, 3, 4, 5, 6, 0]
    : [0, 1, 2, 3, 4, 5, 6]

  const initial = (day: Weekday) => {
    const ref = new Date(2024, 0, 7 + day) // 2024-01-07 was a Sunday
    return new Intl.DateTimeFormat(locale, { weekday: 'narrow' }).format(ref)
  }

  const toggle = (day: Weekday) => {
    const next = new Set(selected)
    if (next.has(day)) next.delete(day)
    else next.add(day)
    onChange([...next].sort((a, b) => a - b) as Weekday[])
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.presets}>
        {presets.map((p) => {
          const active = matches(p.days)
          return (
            <PressableScale
              key={p.label}
              onPress={() => onChange(p.days)}
              depth="sm"
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={p.label}
              style={[
                styles.preset,
                { backgroundColor: active ? c.accent : c.surfaceAlt },
              ]}
            >
              <Text variant="label" style={{ color: active ? c.onAccent : c.inkMuted }}>
                {p.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>

      <View style={styles.strip}>
        {ordered.map((day) => {
          const active = selected.has(day)
          return (
            <PressableScale
              key={day}
              onPress={() => toggle(day)}
              depth="sm"
              haptic={false}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(
                new Date(2024, 0, 7 + day),
              )}
              style={[
                styles.day,
                { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
              ]}
            >
              <Text variant="label" style={{ color: active ? c.accent : c.inkFaint }}>
                {initial(day)}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  presets: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  preset: {
    flex: 1, minWidth: 96, minHeight: 52, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm,
  },
  strip: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1, minHeight: 56, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
})
