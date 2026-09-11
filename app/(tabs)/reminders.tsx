import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { ScreenHeader } from '@/components/ui/ScreenHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { EmptyState } from '@/components/ui/EmptyState'
import { useData } from '@/stores/data'
import { useSettings } from '@/stores/settings'
import { describeReminder } from '@/lib/reminders'
import { describePause, isActive, skipTodayUntil } from '@/lib/pause'
import { applyReminder } from '@/lib/engine/applyReminder'
import { useClock } from '@/hooks/useClock'
import type { Reminder } from '@/lib/types'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

/**
 * Every reminder, in one list.
 *
 * Deliberately NOT split into separate "time" and "place" tabs. Adding is where the
 * distinction matters and the editor asks it plainly; seeing what you have set up is a single
 * question — "did I set that?" — and answering it should not mean checking two places.
 *
 * Each row says what it does as a sentence, so nothing has to be opened to be understood.
 */
export default function RemindersScreen() {
  const router = useRouter()
  const c = useColors()

  const reminders = useData((s) => s.reminders)
  const places = useData((s) => s.places)
  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)

  const placeNames = useMemo(
    () => new Map(places.map((p) => [p.id, p.name])),
    [places],
  )

  const refresh = useData((s) => s.refresh)
  const now = useClock()

  /**
   * Each of these saves through applyReminder, not straight into the store.
   *
   * Going quiet has to reach the PHONE: the reminder's automations must be recompiled and the
   * OS schedule and alarms re-laid. Writing `pausedUntil` into the database alone would leave
   * every already-scheduled notification and armed alarm exactly where it was, so the reminder
   * would look paused on this screen and go off anyway.
   */
  const save = async (next: Reminder) => {
    await applyReminder({ ...next, updatedAt: Date.now() })
    refresh()
  }

  const pause = (reminder: Reminder, until: string) =>
    save({ ...reminder, enabled: true, pausedUntil: until as Reminder['pausedUntil'] })

  const turnOff = (reminder: Reminder) =>
    save({ ...reminder, enabled: false, pausedUntil: undefined })

  const resume = (reminder: Reminder) =>
    save({ ...reminder, enabled: true, pausedUntil: undefined })

  return (
    <Screen>
      <ScreenHeader
        title="Reminders"
        help="Things DailyFlow will tell you, at a time or at a place."
        onAdd={() => router.push('/reminder/new')}
        addLabel="Add a reminder"
      />

      {reminders.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No reminders yet"
          help="Tell DailyFlow what to remind you about, and when."
          actionLabel="Add a reminder"
          onAction={() => router.push('/reminder/new')}
        />
      ) : (
        reminders.map((reminder, i) => (
          <Animated.View
            key={reminder.id}
            entering={FadeInDown.delay(Math.min(i, 5) * 28).springify().damping(18).stiffness(140)}
          >
            <PressableScale onPress={() => router.push(`/reminder/${reminder.id}`)} depth="sm">
              <Card style={[styles.card, !isActive(reminder, now) && { opacity: 0.55 }]}>
                <View style={styles.head}>
                  <IconBadge name={(reminder.icon as IconName) ?? 'bell'} />
                  <View style={styles.text}>
                    <Text variant="heading" numberOfLines={2}>{reminder.title}</Text>
                    <Text variant="caption" tone="muted" numberOfLines={3}>
                      {describeReminder(reminder, { placeNames, use24h, locale })}
                    </Text>
                  </View>
                  <Icon name="forward" size={20} color={c.inkFaint} />
                </View>

                {/* Small marks for what drives it, so a glance says time, place, or both. */}
                <View style={styles.marks}>
                  {reminder.times.length > 0 ? (
                    <Mark icon="clock" label={`${reminder.times.length} time${reminder.times.length === 1 ? '' : 's'}`} />
                  ) : null}
                  {reminder.placeTriggers.length > 0 ? (
                    <Mark icon="place" label={`${reminder.placeTriggers.length} place${reminder.placeTriggers.length === 1 ? '' : 's'}`} />
                  ) : null}
                  {reminder.leadMinutes.some((m) => m > 0) ? (
                    <Mark icon="bell" label="Early warning" />
                  ) : null}
                </View>

                {/*
                  Going quiet must be reachable from HERE, not from inside the editor.
                  "Not today" is a thought people have while looking at the list, and the only
                  way to act on it used to be Remove — which throws away the icon, the times,
                  the place, the sound and the list, so the real choice was delete it and build
                  it again later.
                */}
                <View style={styles.quickRow}>
                  {describePause(reminder, now, locale) ? (
                    <QuickAction
                      icon="play"
                      label={reminder.enabled ? 'Bring it back' : 'Turn it on'}
                      tone="good"
                      onPress={() => void resume(reminder)}
                    />
                  ) : (
                    <>
                      <QuickAction
                        icon="moon"
                        label="Not today"
                        onPress={() => void pause(reminder, skipTodayUntil())}
                      />
                      <QuickAction
                        icon="bellOff"
                        label="Turn it off"
                        onPress={() => void turnOff(reminder)}
                      />
                    </>
                  )}
                </View>

                {describePause(reminder, now, locale) ? (
                  <Text variant="caption" tone="warn" style={{ marginTop: space.xs }}>
                    {describePause(reminder, now, locale)}
                  </Text>
                ) : null}
              </Card>
            </PressableScale>
          </Animated.View>
        ))
      )}
    </Screen>
  )
}

function Mark({ icon, label }: { icon: IconName; label: string }) {
  const c = useColors()
  return (
    <View style={[styles.mark, { backgroundColor: c.canvasDeep }]}>
      <Icon name={icon} size={14} color={c.inkMuted} />
      <Text variant="caption" tone="muted" style={{ fontSize: 12.5 }}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: { marginBottom: space.md, gap: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  text: { flex: 1, gap: 3 },
  quickRow: { flexDirection: 'row', gap: space.xs, marginTop: space.md },
  marks: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  mark: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill,
  },
})

/**
 * One quiet, small action on a reminder row.
 *
 * Deliberately understated: these sit on every row, and a list where each item shouts two
 * buttons is a list nobody can read. Large enough to hit, quiet enough to ignore.
 */
function QuickAction({
  icon, label, onPress, tone,
}: {
  icon: IconName
  label: string
  onPress: () => void
  tone?: 'good'
}) {
  const c = useColors()
  const colour = tone === 'good' ? c.good : c.inkMuted
  return (
    <PressableScale
      onPress={onPress}
      depth="sm"
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[quick.button, { backgroundColor: c.surfaceAlt }]}
    >
      <Icon name={icon} size={16} color={colour} />
      <Text variant="label" style={{ color: colour }}>{label}</Text>
    </PressableScale>
  )
}

const quick = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    minHeight: 40,
    borderRadius: radius.lg,
  },
})
