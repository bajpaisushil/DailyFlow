import React, { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, type IconName } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { activity as activityRepo } from '@/lib/db/repo'
import type { ActivityEvent, ActivityKind } from '@/lib/types'
import { humanDelta } from '@/lib/time'
import { useSettings } from '@/stores/settings'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * "What happened" — a readable record of what DailyFlow did and, importantly, what it chose
 * NOT to do and why. Being able to see a suppressed reminder is what makes the anti-spam
 * rules trustworthy rather than mysterious.
 */
const ICONS: Record<ActivityKind, IconName> = {
  'automation.fired': 'bell',
  'automation.suppressed': 'bellOff',
  'notification.shown': 'bell',
  'checklist.completed': 'checkCircle',
  'place.entered': 'arrive',
  'place.exited': 'leave',
  'routine.started': 'play',
  'routine.ended': 'check',
  'commute.started': 'metro',
  'commute.ended': 'arrive',
  'trigger.missed': 'clock',
}

export default function HistoryScreen() {
  const c = useColors()
  const locale = useSettings((s) => s.settings.locale)
  const [events, setEvents] = useState<ActivityEvent[]>([])

  useEffect(() => {
    setEvents(activityRepo.recent(80))
  }, [])

  const now = Date.now()

  return (
    <Screen>
      <DetailHeader title={S.settings.whatHappened} />

      {events.length === 0 ? (
        <EmptyState
          icon="history"
          title="Nothing yet"
          help="When DailyFlow reminds you of something, it will show here."
        />
      ) : (
        <Card padded={false} style={{ paddingVertical: space.sm }}>
          {events.map((e) => (
            <View key={e.id} style={styles.row}>
              <Icon
                name={ICONS[e.kind] ?? 'clock'}
                size={20}
                color={e.kind === 'automation.suppressed' ? c.inkFaint : c.accent}
              />
              <View style={{ flex: 1 }}>
                <Text variant="body">{e.summary}</Text>
                {e.reason ? (
                  <Text variant="caption" tone="faint">{e.reason}</Text>
                ) : null}
              </View>
              <Text variant="caption" tone="faint">{humanDelta(now, e.at, locale)}</Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.xl, paddingVertical: space.md,
  },
})
