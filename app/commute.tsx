import React, { useCallback, useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { ChecklistCard } from '@/components/today/ChecklistCard'
import { useData } from '@/stores/data'
import { useClock } from '@/hooks/useClock'
import { useSettings } from '@/stores/settings'
import { commuteSessions, newId, activity } from '@/lib/db/repo'
import { buildToday } from '@/lib/today'
import { humanDelta } from '@/lib/time'
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * "On the way".
 *
 * Explicitly NOT a navigation app. It exists to make travel time useful: your list is one
 * tap away, the trip is timed against your own estimate, and nothing here needs a network
 * or a map. Starting and ending are manual by default — honest, and it works even when
 * location is switched off.
 */
export default function CommuteScreen() {
  const c = useColors()
  const now = useClock()

  const active = useData((s) => s.activeCommute)
  const routines = useData((s) => s.routines)
  const places = useData((s) => s.places)
  const checklists = useData((s) => s.checklists)
  const runs = useData((s) => s.runs)
  const toggleItem = useData((s) => s.toggleItem)
  const refresh = useData((s) => s.refresh)
  const locale = useSettings((s) => s.settings.locale)

  const model = useMemo(
    () => buildToday({ now, routines, places, checklists, runs }),
    [now, routines, places, checklists, runs],
  )

  // The trip we are most likely on: whatever is happening or next.
  const focus = model.current ?? model.next

  const start = useCallback(() => {
    commuteSessions.save({
      id: newId(),
      startedAt: Date.now(),
      originPlaceId: focus?.routine.originPlaceId,
      destinationPlaceId: focus?.routine.destinationPlaceId,
    })
    activity.add({ kind: 'commute.started', summary: S.way.started })
    refresh()
  }, [focus, refresh])

  const finish = useCallback(() => {
    if (!active) return
    commuteSessions.save({ ...active, endedAt: Date.now(), arrivedAt: Date.now() })
    activity.add({ kind: 'commute.ended', summary: S.way.arrived })
    refresh()
  }, [active, refresh])

  const destination = active?.destinationPlaceId
    ? places.find((p) => p.id === active.destinationPlaceId)
    : focus?.destination

  const expected = focus?.routine.typicalDurationMinutes

  return (
    <Screen>
      <DetailHeader title={S.way.title} />

      {active ? (
        <Animated.View entering={FadeIn.duration(260)}>
          <Card tone="hero" style={{ marginBottom: space.xl }}>
            <Text variant="label" style={{ color: c.onAccent, opacity: 0.78 }}>
              {S.way.started}
            </Text>
            <Text variant="display" style={{ color: c.onAccent, marginTop: space.xs }}>
              {destination?.name ?? S.way.startedHelp}
            </Text>
            <View style={styles.heroMeta}>
              <Icon name="clock" size={16} color={c.onAccent} />
              <Text variant="caption" style={{ color: c.onAccent, opacity: 0.9 }}>
                Left {humanDelta(now.getTime(), active.startedAt, locale)}
                {expected ? ` · usually about ${expected} minutes` : ''}
              </Text>
            </View>
          </Card>

          <Button label={S.way.endIt} icon="arrive" size="lg" full onPress={finish} />
        </Animated.View>
      ) : (
        <>
          <Card style={{ marginBottom: space.xl }}>
            <View style={styles.row}>
              <IconBadge
                name={(focus?.routine.icon as IconName) ?? 'metro'}
                plate={52}
                size={24}
              />
              <View style={{ flex: 1 }}>
                <Text variant="heading">
                  {focus ? focus.routine.name : S.way.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {destination ? `To ${destination.name}` : 'Start when you set off.'}
                </Text>
              </View>
            </View>
          </Card>

          <Button label={S.way.startIt} icon="play" size="lg" full onPress={start} />
        </>
      )}

      {/* Your list stays one tap away while travelling */}
      {model.checklists.length > 0 ? (
        <View style={{ marginTop: space['2xl'] }}>
          <Text variant="heading" style={styles.section}>
            {S.today.takeWithYou}
          </Text>
          {model.checklists.map((entry) => (
            <ChecklistCard
              key={entry.checklist.id}
              entry={entry}
              onToggle={(itemId) => toggleItem(entry.checklist.id, itemId)}
            />
          ))}
        </View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.md },
  section: { marginBottom: space.md },
})
