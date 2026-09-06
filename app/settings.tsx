import React, { useCallback, useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { useSettings } from '@/stores/settings'
import { useData } from '@/stores/data'
import { useTheme } from '@/theme/ThemeProvider'
import { openSavedCopy, removeEverything, saveCopy } from '@/lib/data/backup'
import { resyncAll } from '@/lib/engine/apply'
import { syncGeofences } from '@/lib/location/geofence'
import { cancelAll } from '@/lib/notify/scheduler'
import type { ThemePreference } from '@/lib/types'
import { space, radius } from '@/theme/tokens'
import { S } from '@/lib/strings'

/**
 * Settings. Ordered by how often people need it: look and feel first, then reminders,
 * then the data controls, with the irreversible action last and guarded.
 */
export default function SettingsScreen() {
  const router = useRouter()
  const { colors: c, preference, setPreference } = useTheme()

  const settings = useSettings((s) => s.settings)
  const update = useSettings((s) => s.update)
  const updateNotifications = useSettings((s) => s.updateNotifications)
  const refresh = useData((s) => s.refresh)

  const [busy, setBusy] = useState(false)

  const themes: Array<{ key: ThemePreference; label: string; icon: IconName }> = [
    { key: 'system', label: S.settings.themeSystem, icon: 'phone' },
    { key: 'light', label: S.settings.themeLight, icon: 'sun' },
    { key: 'dark', label: S.settings.themeDark, icon: 'moon' },
  ]

  const onSaveCopy = useCallback(async () => {
    setBusy(true)
    try {
      await saveCopy()
    } catch {
      Alert.alert(S.error.generic, S.error.genericHelp)
    } finally {
      setBusy(false)
    }
  }, [])

  /**
   * Opening a saved copy REPLACES everything. It used to do so from a single tap on a row
   * labelled "Bring back your things from a saved file", with no warning that what you have
   * now would be destroyed — and if the file turned out to be unusable it had already begun
   * clearing tables, leaving a half-wiped database and no message.
   */
  const onOpenCopy = useCallback(() => {
    Alert.alert(
      'Replace everything?',
      'Opening a saved copy removes what is in DailyFlow now and puts the saved things in its place. This cannot be undone.',
      [
        { text: S.action.goBack, style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: async () => {
            setBusy(true)
            try {
              const result = await openSavedCopy()
              if (!result.ok) {
                if (result.reason === 'cancelled') return
                Alert.alert(
                  result.reason === 'notOurFile' ? S.error.fileNotOurs : S.error.generic,
                  result.reason === 'notOurFile' ? S.error.fileNotOursHelp : S.error.genericHelp,
                )
                return
              }

              refresh()
              // Geofences must be re-armed too. Without this the OS kept watching the region
              // list from BEFORE the import, so every restored place reminder was dead until
              // the app happened to be restarted — with nothing saying so.
              const [schedule, geofence] = await Promise.all([resyncAll(), syncGeofences()])
              Alert.alert(
                S.action.done,
                `Your things are back. ${schedule.scheduled} reminder${schedule.scheduled === 1 ? '' : 's'} set, ${geofence.watched} place${geofence.watched === 1 ? '' : 's'} being watched.`,
              )
            } catch {
              Alert.alert(S.error.generic, S.error.genericHelp)
            } finally {
              // Always clears, so a failure cannot leave the buttons permanently disabled.
              setBusy(false)
            }
          },
        },
      ],
    )
  }, [refresh])

  const onRemoveEverything = useCallback(() => {
    Alert.alert(
      S.settings.removeEverything,
      S.settings.removeEverythingHelp,
      [
        { text: S.action.goBack, style: 'cancel' },
        {
          text: S.action.remove,
          style: 'destructive',
          onPress: () => {
            removeEverything()
            void cancelAll()
            refresh()
            router.replace('/')
          },
        },
      ],
    )
  }, [refresh, router])

  return (
    <Screen>
      <DetailHeader title={S.settings.title} />

      {/* Look */}
      <Text variant="heading" style={styles.section}>{S.settings.look}</Text>
      <View style={styles.themeRow}>
        {themes.map((t) => {
          const active = preference === t.key
          return (
            <PressableScale
              key={t.key}
              onPress={() => setPreference(t.key)}
              depth="sm"
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              style={[
                styles.theme,
                { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
              ]}
            >
              <Icon name={t.icon} size={22} color={active ? c.accent : c.inkFaint} />
              <Text
                variant="label"
                numberOfLines={1}
                style={{ color: active ? c.accent : c.inkMuted, fontSize: 12 }}
              >
                {t.label}
              </Text>
            </PressableScale>
          )
        })}
      </View>

      <View style={{ gap: space.sm, marginTop: space.md, marginBottom: space.xl }}>
        <Toggle
          label="Use 24-hour clock"
          icon="clock"
          value={settings.use24HourClock}
          onChange={(v) => update({ use24HourClock: v })}
        />
      </View>

      {/* Reminders */}
      <Text variant="heading" style={styles.section}>{S.reminder.title}</Text>
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        <Toggle
          label={S.settings.vibrate}
          icon="phone"
          value={settings.notifications.vibrate}
          onChange={(v) => {
            updateNotifications({ vibrate: v })
            void resyncAll()
          }}
        />
        <Toggle
          label={S.settings.doNotWake}
          help={`${settings.notifications.quietHours.from} — ${settings.notifications.quietHours.to}`}
          icon="moon"
          value={settings.notifications.quietHours.enabled}
          onChange={(v) => {
            updateNotifications({
              quietHours: { ...settings.notifications.quietHours, enabled: v },
            })
            // The vibrate toggle directly above resyncs; this one did not, so changing it
            // had no effect until some unrelated edit happened to trigger a sync.
            void resyncAll()
          }}
        />
        <Toggle
          label="Stay quiet if the list is done"
          help="No reminder if you already ticked everything."
          icon="checkCircle"
          value={settings.notifications.suppressWhenChecklistDone}
          onChange={(v) => updateNotifications({ suppressWhenChecklistDone: v })}
        />
      </View>

      {/* Your things */}
      <Text variant="heading" style={styles.section}>{S.settings.yourData}</Text>
      <View style={{ gap: space.sm, marginBottom: space.xl }}>
        <RowLink
          icon="save"
          label={S.settings.saveCopy}
          help={S.settings.saveCopyHelp}
          onPress={() => void onSaveCopy()}
          disabled={busy}
        />
        <RowLink
          icon="open"
          label={S.settings.openCopy}
          help={S.settings.openCopyHelp}
          onPress={onOpenCopy}
          disabled={busy}
        />
        <RowLink
          icon="space"
          label={S.settings.spaceUsed}
          help={S.settings.spaceUsedHelp}
          onPress={() => router.push('/storage')}
        />
      </View>

      {/* Privacy promise */}
      <Card tone="flat" style={{ marginBottom: space.xl }}>
        <View style={styles.noteRow}>
          <Icon name="lock" size={18} color={c.good} />
          <Text variant="label" tone="good">{S.settings.privacy}</Text>
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
          {S.settings.privacyBody}
        </Text>
      </Card>

      <Button
        label={S.settings.removeEverything}
        icon="trash"
        variant="danger"
        full
        onPress={onRemoveEverything}
      />
    </Screen>
  )
}

function RowLink({
  icon, label, help, onPress, disabled,
}: {
  icon: IconName
  label: string
  help?: string
  onPress: () => void
  disabled?: boolean
}) {
  const c = useTheme().colors
  return (
    <PressableScale
      depth="sm"
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.row, { backgroundColor: c.surfaceAlt, opacity: disabled ? 0.5 : 1 }]}
    >
      <Icon name={icon} size={21} color={c.accent} />
      <View style={{ flex: 1 }}>
        <Text variant="body">{label}</Text>
        {help ? <Text variant="caption" tone="muted" numberOfLines={2}>{help}</Text> : null}
      </View>
      <Icon name="forward" size={19} color={c.inkFaint} />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: space.sm },
  themeRow: { flexDirection: 'row', gap: space.sm },
  theme: {
    flex: 1, minHeight: 76, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.sm,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderRadius: radius.lg, minHeight: 64,
  },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
