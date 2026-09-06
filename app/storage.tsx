import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Alert } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { describeBytes, readStorageReport, type StorageReport } from '@/lib/data/storage'
import { activity as activityRepo, settings as settingsRepo } from '@/lib/db/repo'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * Space used (REQUIREMENTS.md #41).
 *
 * Because everything lives on the phone, the user is entitled to see exactly how much room
 * DailyFlow occupies and to reclaim it. Figures are measured from the database, never guessed.
 */
export default function StorageScreen() {
  const c = useColors()
  const [report, setReport] = useState<StorageReport | null>(null)

  const load = () => void readStorageReport().then(setReport)
  useEffect(load, [])

  const largest = report ? Math.max(1, ...report.lines.map((l) => l.bytes)) : 1

  return (
    <Screen>
      <DetailHeader title={S.settings.spaceUsed} />

      <Card tone="hero" style={{ marginBottom: space.xl }}>
        <Text variant="label" style={{ color: c.onAccent, opacity: 0.78 }}>
          {S.appName}
        </Text>
        <Text variant="display" style={{ color: c.onAccent, marginTop: space.xs }}>
          {report ? describeBytes(report.totalBytes) : '…'}
        </Text>
        <Text variant="caption" style={{ color: c.onAccent, opacity: 0.85, marginTop: space.sm }}>
          {report?.freeBytes != null
            ? `Your phone still has ${describeBytes(report.freeBytes)} free.`
            : S.settings.spaceUsedHelp}
        </Text>
      </Card>

      {report ? (
        <Animated.View entering={FadeIn.duration(240)}>
          <Card padded={false} style={{ paddingVertical: space.sm, marginBottom: space.xl }}>
            {report.lines
              .filter((l) => l.rows > 0)
              .sort((a, b) => b.bytes - a.bytes)
              .map((line) => (
                <View key={line.key} style={styles.row}>
                  <View style={styles.rowText}>
                    <Text variant="body">{line.label}</Text>
                    <Text variant="caption" tone="faint">
                      {line.rows === 1 ? '1 item' : `${line.rows} items`}
                    </Text>
                  </View>

                  {/* A bar, because a column of byte counts is unreadable for most people */}
                  <View style={[styles.track, { backgroundColor: c.canvasDeep }]}>
                    <View
                      style={[
                        styles.fill,
                        {
                          backgroundColor: c.accent,
                          width: `${Math.max(6, (line.bytes / largest) * 100)}%`,
                        },
                      ]}
                    />
                  </View>

                  <Text variant="caption" tone="muted" style={styles.size}>
                    {describeBytes(line.bytes)}
                  </Text>
                </View>
              ))}
          </Card>
        </Animated.View>
      ) : null}

      <Card tone="flat" style={{ marginBottom: space.lg }}>
        <View style={styles.noteRow}>
          <Icon name="lock" size={18} color={c.good} />
          <Text variant="label" tone="good">{S.settings.worksOffline}</Text>
        </View>
        <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
          {S.settings.privacyBody}
        </Text>
      </Card>

      <Button
        label="Clear what happened"
        icon="trash"
        variant="secondary"
        full
        onPress={() => {
          Alert.alert(
            'Clear what happened?',
            'The record of what DailyFlow has done will be removed. Your reminders, places and lists are not affected.',
            [
              { text: S.action.goBack, style: 'cancel' },
              {
                text: S.action.remove,
                style: 'destructive',
                onPress: () => {
                  activityRepo.clear()
                  const settings = settingsRepo.read()
                  activityRepo.prune(settings.historyMaxEvents, settings.historyMaxAgeDays)
                  load()
                },
              },
            ],
          )
        }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.xl, paddingVertical: space.md,
  },
  rowText: { width: 128, gap: 1 },
  track: { flex: 1, height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  size: { width: 62, textAlign: 'right' },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
})
