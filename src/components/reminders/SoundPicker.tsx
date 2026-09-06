import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { TONES, type ToneId } from '@/lib/notify/tones'
import { pickSound, deleteSound, savedSounds, type ChosenSound } from '@/lib/notify/customSound'
import { alarmModuleAvailable } from '../../../modules/dailyflow-alarm'

/**
 * Whether a file the user picked can be heard while DailyFlow is closed.
 *
 * True only where the native module exists to be woken by AlarmManager and play it. The OS
 * itself can never do this: an Android notification channel sounds a compiled-in resource and
 * nothing else, and iOS needs its sounds in the app bundle at build time.
 */
function ownSoundPlaysWhenClosed(): boolean {
  return alarmModuleAvailable()
}
import { nowPlaying, onPlaybackChange, playSound, previewTone, stopSound } from '@/lib/notify/player'
import { radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  /** fileName -> the original name, so a reused sound is recognisable. */
  labels?: Record<string, string>
  /**
   * True when this reminder only ever posts a notification. A notification's sound belongs to
   * the OS, not to us, so a chosen file is silently replaced by the phone's own sound — the
   * one thing about custom sounds people are surprised by, so it is said out loud.
   */
  notificationOnly?: boolean
  /** Switch the reminder to a real alarm, which plays the chosen file with no limit. */
  onRingAsAlarm?: () => void
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
  toneId, onToneChange, soundFile, soundLabel, onCustomChange, labels = {},
  notificationOnly = false, onRingAsAlarm,
}: Props) {
  const c = useColors()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * What is sounding right now, so the button can be a real toggle.
   *
   * It used to be a fixed Play icon that only ever started playback: once a sound was going
   * there was no way to stop it except leaving the screen. Subscribing means the icon also
   * returns to Play by itself when a short tone finishes.
   */
  const [playing, setPlaying] = useState<string | null>(nowPlaying())
  useEffect(() => onPlaybackChange(setPlaying), [])

  // Never leave a sound running after the user navigates away.
  useEffect(() => () => void stopSound(), [])

  /**
   * Sounds already in app storage, so one picked for another reminder can be reused with a
   * tap rather than hunted for in the file system again.
   */
  const [saved, setSaved] = useState<ChosenSound[]>([])
  useEffect(() => { setSaved(savedSounds(labels)) }, [labels])

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
    // The previous file is NOT deleted here: another reminder may be using it. Unused files
    // are cleared up by pruneUnusedSounds, which knows what every reminder refers to.
    onCustomChange(result.sound.fileName, result.sound.label)
    setSaved(savedSounds(labels))
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
                <Text variant="caption" tone="muted">
                  {playing === tone.id ? 'Playing — tap to stop' : tone.description}
                </Text>
              </View>
              {playing === tone.id ? <Icon name="close" size={19} color={c.bad} /> : null}
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
              accessibilityLabel={playing === soundFile ? 'Stop' : 'Listen'}
              style={styles.iconBtn}
            >
              <Icon
                name={playing === soundFile ? 'close' : 'play'}
                size={20}
                color={playing === soundFile ? c.bad : c.accent}
              />
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
          <>
            {saved.length > 0 ? (
              <View style={{ gap: space.xs, marginBottom: space.md }}>
                <Text variant="label" tone="muted">Sounds you have used</Text>
                {saved.map((item) => (
                  <PressableScale
                    key={item.fileName}
                    depth="sm"
                    onPress={() => onCustomChange(item.fileName, item.label)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                    style={[styles.saved, { backgroundColor: c.surfaceAlt }]}
                  >
                    <Icon name="speak" size={18} color={c.accent} />
                    <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>{item.label}</Text>
                    <PressableScale
                      onPress={() => void playSound(item.fileName)}
                      accessibilityRole="button"
                      accessibilityLabel={`Listen to ${item.label}`}
                      style={styles.iconBtn}
                    >
                      <Icon
                        name={playing === item.fileName ? 'close' : 'play'}
                        size={18}
                        color={playing === item.fileName ? c.bad : c.accent}
                      />
                    </PressableScale>
                  </PressableScale>
                ))}
              </View>
            ) : null}

            <Button
              label={busy ? 'Choosing…' : saved.length > 0 ? 'Choose another sound' : 'Use my own sound'}
              icon="open"
              variant="secondary"
              full
              disabled={busy}
              onPress={() => void choose()}
            />
          </>
        )}

        {error ? (
          <Text variant="caption" tone="bad" style={{ marginTop: space.sm }}>{error}</Text>
        ) : null}

        {/*
          Whether a chosen file can actually be heard while DailyFlow is closed depends on the
          phone, so this says which case the user is in rather than making one claim for both.

          Android will not let a notification sound a file the user picked — a channel reads
          its sound from the app's own compiled-in resources and can never change it — so
          DailyFlow is woken by AlarmManager and plays the file itself. Where that native piece
          is missing (iOS, Expo Go), it genuinely cannot, and saying so is better than letting
          someone find out at 6am.
        */}
        {soundFile && notificationOnly ? (
          ownSoundPlaysWhenClosed() ? (
            <Text variant="caption" tone="muted" style={{ marginTop: space.md }}>
              DailyFlow plays this itself when the reminder is due, so you hear your own sound
              and not the phone’s — right through to the end, even with the app closed.
            </Text>
          ) : (
            <View style={[styles.warn, { backgroundColor: c.warnSoft }]}>
              <Text variant="body" style={{ fontWeight: '600' }}>
                This phone will use its own notification sound, not yours.
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: space.xs }}>
                A notification’s sound belongs to the phone, and it only offers the sounds that
                came with DailyFlow. Make this an alarm and your own sound plays in full, for as
                long as you set.
              </Text>
              {onRingAsAlarm ? (
                <Button
                  label="Ring it as an alarm"
                  icon="bell"
                  variant="primary"
                  full
                  style={{ marginTop: space.md }}
                  onPress={onRingAsAlarm}
                />
              ) : null}
            </View>
          )
        ) : null}

        <Text variant="caption" tone="faint" style={{ marginTop: space.sm }}>
          {soundFile
            ? 'Your own sound plays as the alarm, and when you tap the reminder. The sounds above also play when DailyFlow is closed.'
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
  saved: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingLeft: space.lg, paddingRight: space.xs,
    borderRadius: radius.lg, minHeight: 56,
  },
  warn: { marginTop: space.md, padding: space.lg, borderRadius: radius.lg },
  iconBtn: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
})
