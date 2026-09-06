import React, { useCallback, useState } from 'react'
import { Platform, View, StyleSheet } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Text } from './Text'
import { Icon, type IconName } from './Icon'
import { PressableScale } from './PressableScale'
import type { HHMM } from '@/lib/types'
import { formatTime, parseHHMM, toHHMM } from '@/lib/time'
import { radius, space } from '@/theme/tokens'
import { useTheme } from '@/theme/ThemeProvider'
import { useSettings } from '@/stores/settings'

interface Props {
  value: HHMM
  onChange: (time: HHMM) => void
}

/**
 * Choosing a time.
 *
 * This used to be a row of quarter-hour chips, which could not express 9:02 at all — and
 * medicine, trains and prayers do not run on quarter hours. It now opens the platform's own
 * time picker: every minute is reachable, and it is a control people have already used
 * hundreds of times in their clock and calendar apps, which matters far more for a hesitant
 * user than anything we could design ourselves.
 *
 * The shortcuts above it are kept because most times ARE round ones, and one tap beats
 * spinning a wheel. They set the picker rather than replacing it.
 */
const SHORTCUTS: Array<{ label: string; time: HHMM; icon: IconName }> = [
  { label: 'Early', time: '06:00', icon: 'sunrise' },
  { label: 'Morning', time: '09:00', icon: 'sun' },
  { label: 'Midday', time: '13:00', icon: 'food' },
  { label: 'Evening', time: '18:00', icon: 'sunset' },
  { label: 'Night', time: '21:00', icon: 'moon' },
]

export function TimePicker({ value, onChange }: Props) {
  const { colors: c, scheme } = useTheme()
  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)

  // Android's picker is a modal that must be summoned; iOS renders inline.
  const [showAndroid, setShowAndroid] = useState(false)

  const asDate = useCallback((time: HHMM): Date => {
    const minutes = parseHHMM(time) ?? 9 * 60
    const d = new Date()
    d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
    return d
  }, [])

  const handleChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      if (Platform.OS === 'android') setShowAndroid(false)
      if (event.type === 'dismissed' || !date) return
      onChange(toHHMM(date.getHours() * 60 + date.getMinutes()))
    },
    [onChange],
  )

  return (
    <View style={{ gap: space.md }}>
      {/* The chosen time, large. On Android this is also the button that opens the picker. */}
      <PressableScale
        onPress={() => Platform.OS === 'android' && setShowAndroid(true)}
        haptic={Platform.OS === 'android'}
        accessibilityRole="button"
        accessibilityLabel={`Time, ${formatTime(value, use24h, locale)}. Tap to change.`}
        style={[styles.readout, { backgroundColor: c.accentSoft }]}
      >
        <Icon name="clock" size={24} color={c.accent} />
        <Text variant="display" style={{ color: c.accent, flex: 1 }}>
          {formatTime(value, use24h, locale)}
        </Text>
        {Platform.OS === 'android' ? (
          <Text variant="label" style={{ color: c.accent }}>Change</Text>
        ) : null}
      </PressableScale>

      {Platform.OS === 'ios' ? (
        <View style={[styles.inline, { backgroundColor: c.surfaceAlt }]}>
          <DateTimePicker
            value={asDate(value)}
            mode="time"
            display="spinner"
            onChange={handleChange}
            themeVariant={scheme}
            style={styles.iosPicker}
          />
        </View>
      ) : showAndroid ? (
        <DateTimePicker
          value={asDate(value)}
          mode="time"
          display="clock"
          is24Hour={use24h}
          onChange={handleChange}
        />
      ) : null}

      {/* Round times, because most times are round ones and one tap beats spinning a wheel. */}
      <View style={styles.shortcuts}>
        {SHORTCUTS.map((shortcut) => {
          const active = value === shortcut.time
          return (
            <PressableScale
              key={shortcut.time}
              onPress={() => onChange(shortcut.time)}
              depth="sm"
              accessibilityRole="button"
              accessibilityLabel={`${shortcut.label}, ${formatTime(shortcut.time, use24h, locale)}`}
              style={[
                styles.shortcut,
                { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
              ]}
            >
              <Icon name={shortcut.icon} size={18} color={active ? c.accent : c.inkFaint} />
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: active ? c.accent : c.inkMuted, fontSize: 12 }}
              >
                {shortcut.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.xl, paddingVertical: space.lg,
    borderRadius: radius.lg, minHeight: 76,
  },
  inline: { borderRadius: radius.lg, overflow: 'hidden', paddingVertical: space.xs },
  iosPicker: { height: 180 },
  shortcuts: { flexDirection: 'row', gap: space.sm },
  shortcut: {
    flex: 1, minHeight: 62, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4,
  },
})
