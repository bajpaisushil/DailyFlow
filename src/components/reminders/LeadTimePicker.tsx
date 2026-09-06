import React, { useState } from 'react'
import { View, StyleSheet, TextInput } from 'react-native'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { LEAD_PRESETS } from '@/lib/types'
import { font, radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  value: number[]
  onChange: (minutes: number[]) => void
}

/**
 * How early to be warned.
 *
 * Several can be chosen at once, because a nudge well ahead and another right before is how
 * people actually use reminders — "tell me half an hour before I leave for the temple, and
 * again five minutes before". The presets cover the common cases with no typing; the custom
 * field exists because real answers are sometimes 23 minutes.
 */
export function LeadTimePicker({ value, onChange }: Props) {
  const c = useColors()
  const [customOpen, setCustomOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const chosen = new Set(value)

  const toggle = (minutes: number) => {
    const next = new Set(chosen)
    if (next.has(minutes)) next.delete(minutes)
    else next.add(minutes)
    // Never end up with nothing: an empty set means "at the time".
    onChange(next.size === 0 ? [0] : [...next].sort((a, b) => b - a))
  }

  const addCustom = () => {
    const minutes = Number.parseInt(draft, 10)
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) return
    onChange([...new Set([...value, minutes])].sort((a, b) => b - a))
    setDraft('')
    setCustomOpen(false)
  }

  /** Custom values the user has added that are not one of the chips. */
  const extras = value.filter((v) => !LEAD_PRESETS.includes(v as never))

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.chips}>
        {LEAD_PRESETS.map((minutes) => {
          const active = chosen.has(minutes)
          return (
            <PressableScale
              key={minutes}
              onPress={() => toggle(minutes)}
              depth="sm"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={describeLead(minutes)}
              style={[
                styles.chip,
                { backgroundColor: active ? c.accent : c.surfaceAlt },
              ]}
            >
              {active ? <Icon name="check" size={16} color={c.onAccent} /> : null}
              <Text variant="label" style={{ color: active ? c.onAccent : c.inkMuted }}>
                {describeLead(minutes)}
              </Text>
            </PressableScale>
          )
        })}

        {extras.map((minutes) => (
          <PressableScale
            key={`extra-${minutes}`}
            onPress={() => toggle(minutes)}
            depth="sm"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: true }}
            accessibilityLabel={describeLead(minutes)}
            style={[styles.chip, { backgroundColor: c.accent }]}
          >
            <Icon name="check" size={16} color={c.onAccent} />
            <Text variant="label" style={{ color: c.onAccent }}>{describeLead(minutes)}</Text>
          </PressableScale>
        ))}

        <PressableScale
          onPress={() => setCustomOpen((v) => !v)}
          depth="sm"
          accessibilityRole="button"
          accessibilityLabel="Some other time"
          style={[styles.chip, { backgroundColor: c.surfaceAlt }]}
        >
          <Icon name="plus" size={17} color={c.inkMuted} />
          <Text variant="label" tone="muted">Other</Text>
        </PressableScale>
      </View>

      {customOpen ? (
        <View style={[styles.custom, { backgroundColor: c.surfaceAlt }]}>
          <Text variant="body" tone="muted">Warn me</Text>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={addCustom}
            keyboardType="number-pad"
            placeholder="23"
            placeholderTextColor={c.inkFaint}
            style={[styles.input, { color: c.ink, backgroundColor: c.surface }]}
            accessibilityLabel="How many minutes before"
            returnKeyType="done"
            maxLength={4}
            autoFocus
          />
          <Text variant="body" tone="muted" style={{ flex: 1 }}>minutes before</Text>
          <PressableScale
            onPress={addCustom}
            accessibilityRole="button"
            accessibilityLabel="Add"
            style={[
              styles.add,
              { backgroundColor: draft.trim() ? c.accent : c.canvasDeep },
            ]}
          >
            <Icon name="check" size={20} color={draft.trim() ? c.onAccent : c.inkFaint} />
          </PressableScale>
        </View>
      ) : null}

      {/* The whole choice, said back as one sentence, so nothing has to be remembered. */}
      <Text variant="caption" tone="muted">{summarise(value)}</Text>
    </View>
  )
}

/** Short label for a chip. Never a bare number. */
export function describeLead(minutes: number): string {
  if (minutes <= 0) return 'At the time'
  if (minutes < 60) return `${minutes} min before`
  const hours = minutes / 60
  if (Number.isInteger(hours)) return hours === 1 ? '1 hour before' : `${hours} hours before`
  return `${minutes} min before`
}

/** The full choice as a sentence. */
export function summarise(value: number[]): string {
  if (value.length === 0) return 'You will be told at the time.'
  const sorted = [...value].sort((a, b) => b - a)
  const parts = sorted.map((m) => (m <= 0 ? 'at the time' : describeLead(m).replace(' before', ' before')))
  if (parts.length === 1) return `You will be told ${parts[0]}.`
  const last = parts[parts.length - 1]
  return `You will be told ${parts.slice(0, -1).join(', ')} and ${last}.`
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs,
    paddingHorizontal: space.lg, minHeight: 48, borderRadius: radius.pill,
  },
  custom: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    padding: space.md, borderRadius: radius.lg,
  },
  input: {
    fontSize: font.base, minWidth: 68, textAlign: 'center',
    paddingVertical: space.md, borderRadius: radius.md,
  },
  add: {
    width: 44, height: 44, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
})
