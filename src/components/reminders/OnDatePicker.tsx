import React, { useState } from 'react'
import { View, StyleSheet, Platform } from 'react-native'
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { PressableScale } from '@/components/ui/PressableScale'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import type { LocalDate, RepeatKind } from '@/lib/types'

/**
 * "Remind me on one particular day" — Diwali, an interview, a birthday.
 *
 * Everything else in the app repeats: a time of day, some weekdays, maybe for a fortnight.
 * That covers habits, and habits are most of what people set. But the reminders that matter
 * most are often the ones that happen ONCE, on a date they must not get wrong, and there was
 * no way to express that at all — only "every Tuesday" or "for the next 3 days".
 *
 * The engine already understood dated reminders; this is the missing way to say one.
 */

export function toLocalDate(date: Date): LocalDate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as LocalDate
}

export function fromLocalDate(value: LocalDate): Date {
  // Parsed as local midday, not midnight: midnight can land on the previous day once a
  // timezone offset is applied, which would show the wrong date back to the user.
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0)
}

/** "Sunday, 8 November" — the weekday matters as much as the number when planning. */
export function describeDate(value: LocalDate, locale?: string): string {
  try {
    return fromLocalDate(value).toLocaleDateString(locale, {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  } catch {
    return value
  }
}

interface Props {
  value?: LocalDate
  onChange: (next: LocalDate | undefined) => void
  locale?: string
}

export function OnDatePicker({ value, onChange, locale }: Props) {
  const c = useColors()
  const [picking, setPicking] = useState(false)

  const handle = (event: DateTimePickerEvent, date?: Date) => {
    // Android fires 'dismissed' on cancel; without this a cancel would set today's date.
    setPicking(false)
    if (event.type === 'dismissed' || !date) return
    onChange(toLocalDate(date))
  }

  return (
    <View>
      {value ? (
        <PressableScale
          depth="sm"
          onPress={() => setPicking(true)}
          accessibilityRole="button"
          accessibilityLabel={`Change the date, currently ${describeDate(value, locale)}`}
          style={[styles.chosen, { backgroundColor: c.accentSoft }]}
        >
          <Icon name="calendar" size={20} color={c.accent} />
          <Text variant="body" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
            {describeDate(value, locale)}
          </Text>
          <PressableScale
            onPress={() => onChange(undefined)}
            accessibilityRole="button"
            accessibilityLabel="Remove this date"
            hitSlop={10}
            style={styles.clear}
          >
            <Icon name="close" size={18} color={c.inkFaint} />
          </PressableScale>
        </PressableScale>
      ) : (
        <Button
          label="Pick a day"
          icon="calendar"
          variant="secondary"
          full
          onPress={() => setPicking(true)}
        />
      )}

      {picking ? (
        <DateTimePicker
          value={value ? fromLocalDate(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          // Nobody sets a reminder for a day that has already gone.
          minimumDate={new Date()}
          onChange={handle}
        />
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  chosen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    borderRadius: radius.lg,
    minHeight: 60,
  },
  clear: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})

/** How a dated repeat reads back: "Every year on Sunday, 8 November". */
export function describeDated(
  kind: RepeatKind | undefined,
  date: LocalDate,
  locale?: string,
): string {
  const day = describeDate(date, locale)
  switch (kind) {
    case 'yearly':
      return `Every year on ${day}.`
    case 'monthly':
      return `Every month on the ${ordinal(fromLocalDate(date).getDate())}.`
    default:
      return `Once, on ${day}. It will not repeat.`
  }
}

/** "31st", not "31th" — a small thing that makes a screen look written rather than generated. */
function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  switch (n % 10) {
    case 1: return `${n}st`
    case 2: return `${n}nd`
    case 3: return `${n}rd`
    default: return `${n}th`
  }
}
