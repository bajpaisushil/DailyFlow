import React, { useCallback, useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  lastSchedulingError, notifyNow, pendingNotifications, readPermission,
  requestPermission, type PendingItem, type PermissionState,
} from '@/lib/notify/scheduler'
import { resyncAll } from '@/lib/engine/apply'
import { useData } from '@/stores/data'
import { Linking, Platform } from 'react-native'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

/**
 * What the phone is actually holding.
 *
 * "Your reminder is set" was, until this screen existed, something the app asserted and
 * nobody could verify. When a reminder failed to arrive there was no way to tell a
 * scheduling bug from a refused permission from a battery setting — the app looked identical
 * in all three cases, and the only available response was to guess.
 *
 * This reads the pending list back out of the operating system. If a reminder is not here,
 * it will not arrive, whatever the rest of the app claims.
 */
export default function ScheduledScreen() {
  const c = useColors()
  const reminders = useData((s) => s.reminders)
  const automations = useData((s) => s.automations)

  const [pending, setPending] = useState<PendingItem[]>([])
  const [permission, setPermission] = useState<PermissionState>('undetermined')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [items, perm] = await Promise.all([pendingNotifications(), readPermission()])
    setPending(items)
    setPermission(perm)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const enabledReminders = reminders.filter((r) => r.enabled).length
  const enabledAutomations = automations.filter((a) => a.enabled).length
  const error = lastSchedulingError()

  return (
    <Screen>
      <DetailHeader title="What is set" />

      {/* The one thing that decides whether anything can arrive at all. */}
      <Card
        style={[
          styles.status,
          { backgroundColor: permission === 'granted' ? c.goodSoft : c.warnSoft },
        ]}
      >
        <View style={styles.row}>
          <Icon
            name={permission === 'granted' ? 'checkCircle' : 'bellOff'}
            size={22}
            color={permission === 'granted' ? c.good : c.warn}
          />
          <Text
            variant="heading"
            style={{ color: permission === 'granted' ? c.good : c.warn, flex: 1 }}
          >
            {permission === 'granted'
              ? 'DailyFlow is allowed to send reminders'
              : 'DailyFlow is not allowed to send reminders'}
          </Text>
        </View>
        {permission !== 'granted' ? (
          <Button
            label="Allow reminders"
            icon="bell"
            full
            style={{ marginTop: space.md }}
            onPress={async () => {
              await requestPermission()
              await resyncAll()
              await load()
            }}
          />
        ) : null}
      </Card>

      {/* Counts side by side: a mismatch here is the fault, and it is visible at a glance. */}
      <View style={styles.counts}>
        <Count label="Reminders you made" value={enabledReminders} />
        <Count label="Rules they became" value={enabledAutomations} />
        <Count
          label="Waiting in the phone"
          value={pending.length}
          warn={pending.length === 0 && enabledAutomations > 0}
        />
      </View>

      {pending.length === 0 && enabledAutomations > 0 ? (
        <Card style={[styles.status, { backgroundColor: c.badSoft }]}>
          <Text variant="heading" style={{ color: c.bad }}>Nothing is waiting</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: space.xs }}>
            You have {enabledAutomations} rule{enabledAutomations === 1 ? '' : 's'}, but the
            phone is holding none of them, so nothing can arrive. Tap Set them up again below.
          </Text>
        </Card>
      ) : null}

      {error ? (
        <Card tone="flat" style={{ marginBottom: space.lg }}>
          <Text variant="label" tone="bad">Last error</Text>
          <Text variant="caption" tone="muted" style={{ marginTop: space.xs }}>{error}</Text>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button
          label={busy ? 'Working…' : 'Set them up again'}
          icon="repeat"
          variant="secondary"
          full
          disabled={busy}
          onPress={async () => {
            setBusy(true)
            await resyncAll()
            await load()
            setBusy(false)
          }}
        />
        <Button
          label="Send a test now"
          icon="bell"
          variant="quiet"
          full
          onPress={() =>
            void notifyNow({
              title: 'DailyFlow works',
              body: 'If you can see this, reminders can reach you.',
            })
          }
        />
      </View>

      {/* The single most common reason a correctly-scheduled reminder never arrives on
          Android — and it is invisible from inside the app, so it has to be said. */}
      {Platform.OS === 'android' ? (
        <Card tone="flat" style={{ marginTop: space.lg }}>
          <View style={styles.row}>
            <Icon name="battery" size={20} color={c.warn} />
            <Text variant="heading" style={{ flex: 1 }}>Still nothing arriving?</Text>
          </View>
          <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            Many phones — Xiaomi, Realme, Oppo, Vivo, OnePlus and Samsung — stop apps from
            waking up to save battery. If reminders are waiting below but never arrive, this
            is almost always why.
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            Allow DailyFlow to run in the background, and turn off battery saving for it.
          </Text>
          <Button
            label="Open battery settings"
            icon="settings"
            variant="secondary"
            full
            style={{ marginTop: space.md }}
            onPress={() => {
              // Goes straight to the exemption prompt where the OS allows it, and falls back
              // to the app's own settings page, which every Android version has.
              Linking.sendIntent?.('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS')
                .catch(() => void Linking.openSettings())
            }}
          />
        </Card>
      ) : null}

      <Text variant="heading" style={{ marginBottom: space.md, marginTop: space.lg }}>
        Waiting in the phone
      </Text>

      {pending.length === 0 ? (
        <EmptyState
          icon="clock"
          title="Nothing waiting"
          help="Make a reminder with a time, and it will appear here."
        />
      ) : (
        <Card padded={false} style={{ paddingVertical: space.sm }}>
          {pending.map((item) => (
            <View key={item.id} style={styles.pending}>
              <Icon name="clock" size={19} color={c.accent} />
              <View style={{ flex: 1 }}>
                <Text variant="body" numberOfLines={1}>{item.title}</Text>
                <Text variant="caption" tone="muted">{item.when}</Text>
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}

function Count({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  const c = useColors()
  return (
    <Card tone="flat" style={styles.count}>
      <Text variant="display" style={{ color: warn ? c.bad : c.ink }}>{value}</Text>
      <Text variant="caption" tone="muted" numberOfLines={2}>{label}</Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  status: { marginBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  counts: { flexDirection: 'row', gap: space.sm, marginBottom: space.lg },
  count: { flex: 1, alignItems: 'flex-start', gap: 2, minHeight: 104 },
  actions: { gap: space.sm },
  pending: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.xl, paddingVertical: space.md,
  },
})
