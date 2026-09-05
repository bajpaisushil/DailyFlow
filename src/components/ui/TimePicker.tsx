import React, { useMemo, useRef, useEffect } from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Text } from './Text'
import { Icon, type IconName } from './Icon'
import { PressableScale } from './PressableScale'
import type { HHMM } from '@/lib/types'
import { formatTime, parseHHMM, toHHMM } from '@/lib/time'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { useSettings } from '@/stores/settings'

interface Props {
  value: HHMM
  onChange: (time: HHMM) => void
}

/**
 * Time without a keypad.
 *
 * Stage one is the part of the day, named and pictured; stage two is a scrolling row of
 * quarter-hour times inside it. Nobody has to read a clock face, type digits, or drag a
 * fiddly wheel — and the chosen time is always shown as a full sentence-sized label.
 */
const PARTS: Array<{ key: string; label: string; icon: IconName; from: number; to: number }> = [
  { key: 'earlyMorning', label: 'Early morning', icon: 'sunrise', from: 4 * 60, to: 8 * 60 },
  { key: 'morning', label: 'Morning', icon: 'sun', from: 8 * 60, to: 12 * 60 },
  { key: 'midday', label: 'Midday', icon: 'food', from: 12 * 60, to: 15 * 60 },
  { key: 'afternoon', label: 'Afternoon', icon: 'sunset', from: 15 * 60, to: 18 * 60 },
  { key: 'evening', label: 'Evening', icon: 'moon', from: 18 * 60, to: 22 * 60 },
  { key: 'night', label: 'Night', icon: 'moon', from: 22 * 60, to: 28 * 60 },
]

const STEP_MINUTES = 15

export function TimePicker({ value, onChange }: Props) {
  const c = useColors()
  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)
  const scroller = useRef<ScrollView>(null)

  const current = parseHHMM(value) ?? 7 * 60

  const activePart = useMemo(
    () => PARTS.find((p) => current >= p.from && current < p.to) ?? PARTS[1]!,
    [current],
  )

  const slots = useMemo(() => {
    const out: number[] = []
    for (let m = activePart.from; m < activePart.to; m += STEP_MINUTES) out.push(m % 1440)
    return out
  }, [activePart])

  // Keep the chosen time in view when the part changes.
  useEffect(() => {
    const index = slots.indexOf(current)
    if (index >= 0) {
      scroller.current?.scrollTo({ x: Math.max(0, index * 88 - 88), animated: true })
    }
  }, [slots, current])

  return (
    <View style={{ gap: space.md }}>
      {/* The answer, always visible as a word-sized label */}
      <View style={[styles.readout, { backgroundColor: c.accentSoft }]}>
        <Icon name={activePart.icon} size={22} color={c.accent} />
        <Text variant="title" style={{ color: c.accent }}>
          {formatTime(value, use24h, locale)}
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {PARTS.map((p) => {
          const active = p.key === activePart.key
          return (
            <PressableScale
              key={p.key}
              onPress={() => onChange(toHHMM(p.from + 60))}
              depth="sm"
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={p.label}
              style={[
                styles.part,
                { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
              ]}
            >
              <Icon name={p.icon} size={20} color={active ? c.accent : c.inkFaint} />
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: active ? c.accent : c.inkMuted, fontSize: 12 }}
              >
                {p.label}
              </Text>
            </PressableScale>
          )
        })}
      </ScrollView>

      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {slots.map((m) => {
          const time = toHHMM(m)
          const active = m === current
          return (
            <PressableScale
              key={m}
              onPress={() => onChange(time)}
              depth="sm"
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={formatTime(time, use24h, locale)}
              style={[
                styles.slot,
                { backgroundColor: active ? c.accent : c.surfaceAlt },
              ]}
            >
              <Text variant="label" style={{ color: active ? c.onAccent : c.inkMuted }}>
                {formatTime(time, use24h, locale)}
              </Text>
            </PressableScale>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.xl, paddingVertical: space.lg, borderRadius: radius.md,
  },
  row: { gap: space.sm, paddingRight: space.xl },
  part: {
    minWidth: 108, minHeight: 68, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: space.sm,
  },
  slot: {
    minWidth: 84, minHeight: 56, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md,
  },
})
