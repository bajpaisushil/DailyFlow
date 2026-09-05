import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { ChecklistCard } from '@/components/today/ChecklistCard'
import { PermissionCard } from '@/components/ui/PermissionCard'
import { WelcomeCard } from '@/components/today/WelcomeCard'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useData } from '@/stores/data'
import { useSettings } from '@/stores/settings'
import { useClock } from '@/hooks/useClock'
import { buildToday } from '@/lib/today'
import { markOnboarded } from '@/lib/data/seed'
import { EXPO_GO_LIMITATION } from '@/lib/runtime'
import { formatTime, toHHMM } from '@/lib/time'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * Today — the home screen and the whole point of the app.
 *
 * It shows what is happening now, what is next, and what to remember. It is not a task
 * list: nothing here is a backlog, and it changes shape through the day.
 */
export default function TodayScreen() {
  const now = useClock()
  const router = useRouter()
  const c = useColors()

  const routines = useData((s) => s.routines)
  const places = useData((s) => s.places)
  const checklists = useData((s) => s.checklists)
  const runs = useData((s) => s.runs)
  const toggleItem = useData((s) => s.toggleItem)

  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)
  const { caps, askForReminders, openPhoneSettings } = useCapabilities()

  const onboardedAt = useSettings((s) => s.settings.onboardingCompletedAt)
  const reloadSettings = useSettings((s) => s.reload)
  const isFirstRun = onboardedAt == null

  const model = useMemo(
    () => buildToday({ now, routines, places, checklists, runs }),
    [now, routines, places, checklists, runs],
  )

  const dateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(now),
    [now, locale],
  )

  const focus = model.current ?? model.next

  // Ask about reminders only once there is a plan that would actually send one. Before
  // that the permission has no purpose, and asking would be the nagging we promised to avoid.
  const hasPlans = routines.some((r) => r.enabled)
  // Only ask when asking can actually achieve something. In Expo Go the permission exists
  // but the scheduler does not, so prompting would be a dead end.
  const needsReminderPermission =
    !isFirstRun && hasPlans && caps.canScheduleAtAll && !caps.remindersWorkWhenClosed
  const cannotSchedule = !isFirstRun && hasPlans && !caps.canScheduleAtAll

  return (
    <Screen>
      {/* Greeting */}
      <Animated.View entering={FadeInDown.duration(320)} style={styles.greeting}>
        <Text variant="display">{S.today[model.greeting]}</Text>
        <Text variant="body" tone="muted">{dateLabel}</Text>
      </Animated.View>

      {isFirstRun ? (
        <WelcomeCard
          onDismiss={() => {
            markOnboarded()
            reloadSettings()
          }}
        />
      ) : null}

      {cannotSchedule ? (
        <Card tone="flat" style={{ marginBottom: space.lg }}>
          <View style={styles.notice}>
            <Icon name="phoneOff" size={19} color={c.warn} />
            <Text variant="caption" tone="muted" style={{ flex: 1 }}>
              {EXPO_GO_LIMITATION}
            </Text>
          </View>
        </Card>
      ) : null}

      {needsReminderPermission ? (
        <PermissionCard
          kind="reminders"
          state={caps.notifications === 'denied' ? 'denied' : 'undetermined'}
          onAsk={() => void askForReminders()}
          onOpenSettings={openPhoneSettings}
        />
      ) : null}

      {/* What is happening now / next */}
      {focus ? (
        <Animated.View entering={FadeInDown.delay(60).duration(320)}>
          <Card tone="hero" style={{ marginBottom: space.lg }}>
            <Text variant="label" style={{ color: c.onAccent, opacity: 0.75 }}>
              {focus.status === 'now' ? S.today.now : S.today.next}
            </Text>
            <View style={styles.heroRow}>
              <Text variant="title" style={{ color: c.onAccent, flex: 1 }}>
                {focus.routine.name}
              </Text>
              <Text variant="title" style={{ color: c.onAccent }}>
                {formatTime(toHHMM(focus.startsAtMinutes), use24h, locale)}
              </Text>
            </View>
            {focus.destination ? (
              <View style={styles.heroMeta}>
                <Icon name="forward" size={16} color={c.onAccent} />
                <Text variant="caption" style={{ color: c.onAccent, opacity: 0.85 }}>
                  {focus.destination.name}
                </Text>
              </View>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      {/* What to remember */}
      {model.checklists.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <Text variant="label" tone="muted" style={styles.sectionTitle}>
            {S.today.takeWithYou}
          </Text>
          {model.checklists.map((entry) => (
            <ChecklistCard
              key={entry.checklist.id}
              entry={entry}
              onToggle={(itemId) => toggleItem(entry.checklist.id, itemId)}
            />
          ))}
        </Animated.View>
      ) : null}

      {/* The rest of the day */}
      {model.entries.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(180).duration(320)}>
          <Text variant="label" tone="muted" style={styles.sectionTitle}>
            {S.nav.today}
          </Text>
          <Card padded={false} style={{ paddingVertical: space.xs }}>
            {model.entries.map((e) => {
              const done = e.status === 'past'
              return (
                <PressableScale
                  key={e.routine.id}
                  depth="sm"
                  onPress={() => router.push(`/plan/${e.routine.id}`)}
                  style={styles.timelineRow}
                  accessibilityLabel={e.routine.name}
                >
                  <IconBadge
                    name={(e.routine.icon as IconName) ?? 'clock'}
                    plate={38}
                    size={19}
                    background={done ? c.canvasDeep : e.status === 'now' ? c.goodSoft : c.accentSoft}
                    color={done ? c.inkFaint : e.status === 'now' ? c.good : c.accent}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={done ? { color: c.inkFaint } : undefined}>
                      {e.routine.name}
                    </Text>
                    <Text variant="caption" tone="faint">
                      {formatTime(toHHMM(e.startsAtMinutes), use24h, locale)}
                    </Text>
                  </View>
                  {done ? <Icon name="check" size={18} color={c.good} /> : null}
                </PressableScale>
              )
            })}
          </Card>
        </Animated.View>
      ) : null}

      {/* Free day — an invitation, never an error */}
      {model.isFreeDay && model.checklists.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <Card style={styles.empty}>
            <IconBadge name="sparkle" plate={56} size={26} />
            <Text variant="heading" center style={{ marginTop: space.lg }}>
              {S.today.freeDay}
            </Text>
            <Text variant="caption" tone="muted" center style={{ marginTop: space.xs }}>
              {S.today.freeDayHelp}
            </Text>
            <Button
              label={S.plan.addOne}
              icon="plus"
              onPress={() => router.push('/plan/new')}
              style={{ marginTop: space.xl }}
            />
          </Card>
        </Animated.View>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  greeting: { marginBottom: space['2xl'], gap: space.xs },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.xs },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  sectionTitle: {
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: space.md,
    marginTop: space.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
  empty: { alignItems: 'center', paddingVertical: space['3xl'] },
  notice: { flexDirection: 'row', alignItems: 'center', gap: space.md },
})
