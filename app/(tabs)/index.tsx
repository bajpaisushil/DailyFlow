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
import { CountdownRing, describeWait } from '@/components/today/CountdownRing'
import { PermissionCard } from '@/components/ui/PermissionCard'
import { WelcomeCard } from '@/components/today/WelcomeCard'
import { useCapabilities } from '@/hooks/useCapabilities'
import { useData } from '@/stores/data'
import { useSettings } from '@/stores/settings'
import { useClock } from '@/hooks/useClock'
import { buildToday } from '@/lib/today'
import { markOnboarded } from '@/lib/data/seed'
import { EXPO_GO_LIMITATION } from '@/lib/runtime'
import { formatLongDate, formatTime, humanDelta, minutesOfDay, toHHMM } from '@/lib/time'
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
  const reminders = useData((s) => s.reminders)
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
    () => buildToday({ now, routines, reminders, places, checklists, runs }),
    [now, routines, reminders, places, checklists, runs],
  )

  const dateLabel = useMemo(
    () =>
      formatLongDate(now, locale),
    [now, locale],
  )

  const focus = model.current ?? model.next
  const minutesAway = focus ? focus.startsAtMinutes - minutesOfDay(now) : 0

  // Ask about reminders only once there is a plan that would actually send one. Before
  // that the permission has no purpose, and asking would be the nagging we promised to avoid.
  /**
   * Anything at all that is supposed to reach the user.
   *
   * This used to check only routines, so someone who had created REMINDERS -- which is now
   * the whole point of the app -- was told nothing about the fact that none of them could
   * possibly fire. They set things up and got silence, with no explanation. Silence that
   * looks like a working app is the single worst failure this product can have.
   */
  const hasAnythingScheduled =
    routines.some((r) => r.enabled) || reminders.some((r) => r.enabled)
  // Only ask when asking can actually achieve something. In Expo Go the permission exists
  // but the scheduler does not, so prompting would be a dead end.
  const needsReminderPermission =
    !isFirstRun && hasAnythingScheduled && caps.canScheduleAtAll && !caps.remindersWorkWhenClosed
  const cannotSchedule = !isFirstRun && hasAnythingScheduled && !caps.canScheduleAtAll

  return (
    <Screen>
      {/* Greeting */}
      <Animated.View entering={FadeInDown.springify().damping(18).stiffness(140)} style={styles.greeting}>
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
        <Card style={[styles.warningCard, { backgroundColor: c.warnSoft }]}>
          <View style={styles.notice}>
            <Icon name="phoneOff" size={22} color={c.warn} />
            <Text variant="heading" style={{ color: c.warn, flex: 1 }}>
              Nothing will reach you yet
            </Text>
          </View>
          <Text variant="body" tone="muted" style={{ marginTop: space.sm }}>
            {EXPO_GO_LIMITATION}
          </Text>
          <Text variant="caption" tone="muted" style={{ marginTop: space.sm }}>
            Your reminders are saved and will work as soon as you use the real app.
          </Text>
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
        <Animated.View entering={FadeInDown.delay(60).springify().damping(18).stiffness(140)}>
          <Card tone="hero" style={{ marginBottom: space.lg }}>
            {/*
              Says how late it is rather than insisting it is happening now. An entry stays in
              this slot for the whole window it remains worth doing — half an hour for a
              reminder — and calling all of that "Now" was plainly untrue ten minutes in.
            */}
            <Text variant="label" style={{ color: c.onAccent, opacity: 0.78 }}>
              {focus.status !== 'now'
                ? S.today.next
                : focus.minutesLate < 2
                  ? S.today.now
                  : `Due ${humanDelta(now.getTime(), now.getTime() - focus.minutesLate * 60_000)}`}
            </Text>

            <View style={styles.heroRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="title" style={{ color: c.onAccent }} numberOfLines={2}>
                  {focus.title}
                </Text>
                {/* How long away, in words. The literal time stays below it, but nobody
                    should have to subtract to find out when they need to move. */}
                <Text variant="body" style={{ color: c.onAccent, opacity: 0.9 }}>
                  {describeWait(minutesAway)} · {formatTime(toHHMM(focus.startsAtMinutes), use24h, locale)}
                </Text>
              </View>

              <CountdownRing
                minutesAway={minutesAway}
                color={c.onAccent}
                trackColor={c.onAccent}
              />
            </View>

            {focus.destination ? (
              <View style={styles.heroMeta}>
                <Icon name="arrive" size={16} color={c.onAccent} />
                <Text variant="caption" style={{ color: c.onAccent, opacity: 0.88 }}>
                  {focus.destination.name}
                </Text>
              </View>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      {/* What is coming up — reminders and day plans together. This is the
          question Today exists to answer, so it comes before the packing list. */}
      {model.entries.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(180).springify().damping(18).stiffness(140)}>
          <Text variant="heading" style={styles.sectionTitle}>
            {'Rest of today'}
          </Text>
          <Card padded={false} style={{ paddingVertical: space.xs }}>
            {model.entries.map((e) => {
              const done = e.status === 'past'
              return (
                <PressableScale
                  key={e.id}
                  depth="sm"
                  onPress={() =>
                    router.push(
                      e.source === 'routine'
                        ? `/plan/${e.routine?.id ?? ''}`
                        : `/reminder/${e.id.split(':')[0]}`,
                    )
                  }
                  style={styles.timelineRow}
                  accessibilityLabel={e.title}
                >
                  <IconBadge
                    name={(e.icon as IconName) ?? 'clock'}
                    plate={38}
                    size={19}
                    background={done ? c.canvasDeep : e.status === 'now' ? c.goodSoft : c.accentSoft}
                    color={done ? c.inkFaint : e.status === 'now' ? c.good : c.accent}
                  />
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={done ? { color: c.inkFaint } : undefined}>
                      {e.title}
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

      {/* Only after the day is laid out: what to carry. */}
      {model.checklists.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
          <Text variant="heading" style={styles.sectionTitle}>
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

      {/* Free day — an invitation, never an error */}
      {model.isFreeDay && model.checklists.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(120).springify().damping(18).stiffness(140)}>
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
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
  sectionTitle: {
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
  warningCard: { marginBottom: space.lg },
})
