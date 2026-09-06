import React, { useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { TONES, type ToneId } from '@/lib/notify/tones'
import { pickSound, deleteSound } from '@/lib/notify/customSound'
import { playSound, previewTone, stopSound } from '@/lib/notify/player'
import { radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  toneId: ToneId
  onToneChange: (id: ToneId) => void
  soundFile?: string
  soundLabel?: string
  onCustomChange: (file: string | undefined, label: string | undefined) => void
}

/**
 * Choosing what a reminder sounds like.
 *
 * Two routes, and the difference between them is stated rather than hidden, because it
 * decides whether the sound is heard at all:
 *
 *  - A BUNDLED tone plays even when DailyFlow is closed. Android reads a channel's sound from
 *    the app's own resources, so only a sound shipped with the app can be the one the system
 *    plays for a notification.
 *  - YOUR OWN file plays when the reminder is tapped, when it arrives with the app open, and
 *    as the looping sound of a full-screen alarm.
 *
 * Every tone can be previewed before it is chosen. Picking a sound you cannot hear first is
 * how people end up with an alarm they hate.
 */
export function SoundPicker({
  toneId, onToneChange, soundFile, soundLabel, onCustomChange,
}: Props) {
  const c = useColors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const choose = async () => {
    setBusy(true)
    setError(null)
    const result = await pickSound()
    setBusy(false)

    if (!result.ok) {
      if (result.reason === 'cancelled') return
      setError(
        result.reason === 'tooLarge'
          ? 'That file is too big. Choose one under about 8 MB.'
          : 'That file could not be used. Try another one.',
      )
      return
    }
    // Replace rather than accumulate: an unused sound file is dead weight on the phone.
    if (soundFile) deleteSound(soundFile)
    onCustomChange(result.sound.fileName, result.sound.label)
  }

  return (
    <View style={{ gap: space.md }}>
      <View style={styles.tones}>
        {TONES.map((tone) => {
          const active = !soundFile && toneId === tone.id
          return (
            <PressableScale
              key={tone.id}
              depth="sm"
              onPress={() => {
                onToneChange(tone.id)
                onCustomChange(undefined, undefined)
                // Play it on selection: a sound chosen unheard is one the user regrets at 6am.
                void previewTone(tone.id)
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${tone.label}. ${tone.description}`}
              style={[
                styles.tone,
                { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
              ]}
            >
              <Icon
                name={active ? 'checkCircle' : 'speak'}
                size={19}
                color={active ? c.accent : c.inkFaint}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ color: active ? c.accent : c.ink }}>
                  {tone.label}
                </Text>
                <Text variant="caption" tone="muted">{tone.description}</Text>
              </View>
            </PressableScale>
          )
        })}
      </View>

      {/* Your own file. Kept visually separate because it behaves differently. */}
      <Card tone="flat">
        {soundFile ? (
          <View style={styles.chosen}>
            <Icon name="speak" size={20} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text variant="body" numberOfLines={1}>{soundLabel ?? 'Your sound'}</Text>
              <Text variant="caption" tone="muted">Your own file</Text>
            </View>
            <PressableScale
              onPress={() => void playSound(soundFile)}
              accessibilityRole="button"
              accessibilityLabel="Listen"
              style={styles.iconBtn}
            >
              <Icon name="play" size={19} color={c.accent} />
            </PressableScale>
            <PressableScale
              onPress={() => {
                void stopSound()
                deleteSound(soundFile)
                onCustomChange(undefined, undefined)
              }}
              accessibilityRole="button"
              accessibilityLabel="Remove this sound"
              style={styles.iconBtn}
            >
              <Icon name="close" size={19} color={c.inkFaint} />
            </PressableScale>
          </View>
        ) : (
          <Button
            label={busy ? 'Choosing…' : 'Use my own sound'}
            icon="open"
            variant="secondary"
            full
            disabled={busy}
            onPress={() => void choose()}
          />
        )}

        {error ? (
          <Text variant="caption" tone="bad" style={{ marginTop: space.sm }}>{error}</Text>
        ) : null}

        <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
          {soundFile
            ? 'Your own sound plays when you tap the reminder, and as the alarm. The sounds above also play when DailyFlow is closed.'
            : 'These sounds play even when DailyFlow is closed.'}
        </Text>
      </Card>
    </View>
  )
}

const styles = StyleSheet.create({
  tones: { gap: space.xs },
  tone: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderRadius: radius.lg, minHeight: 60,
  },
  chosen: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconBtn: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})
