import React, { useCallback, useMemo, useState } from 'react'
import { View, StyleSheet, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { SaveBar, SAVE_BAR_CLEARANCE } from '@/components/ui/SaveBar'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { IconPicker } from '@/components/ui/IconPicker'
import { DayPicker } from '@/components/ui/DayPicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { Toggle } from '@/components/ui/Toggle'
import { CapabilityBadge, type Reach } from '@/components/ui/CapabilityBadge'
import { useData } from '@/stores/data'
import { newId } from '@/lib/db/repo'
import { applyRoutine, removeRoutine as removeRoutineAndRules } from '@/lib/engine/apply'
import { notificationsAvailable, readPermission, requestPermission } from '@/lib/notify/scheduler'
import type { Routine, Weekday } from '@/lib/types'
import { WEEKDAYS_MON_FRI } from '@/lib/time'
import { space, radius, font } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * Day plan editor.
 *
 * This screen is the 20-second promise: name, days, time, what to take — and DailyFlow
 * generates the underlying rules and hands the clock-based ones to the OS. The user never
 * sees the word "automation", and never builds one by hand unless they want to.
 */

const NAME_SUGGESTIONS = ['Work', 'School', 'Gym', 'Morning', 'Night', 'Medicine', 'Shopping']

export default function PlanEditor() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const c = useColors()

  const routines = useData((s) => s.routines)
  const checklists = useData((s) => s.checklists)
  const places = useData((s) => s.places)
  const refresh = useData((s) => s.refresh)

  const isNew = id === 'new'
  const existing = useMemo(() => routines.find((r) => r.id === id), [routines, id])

  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState<string>(existing?.icon ?? 'repeat')
  const [days, setDays] = useState<Weekday[]>(existing?.days ?? WEEKDAYS_MON_FRI)
  const [time, setTime] = useState(existing?.startTime ?? '07:00')
  const [listIds, setListIds] = useState<string[]>(existing?.checklistIds ?? [])
  const [originId, setOriginId] = useState(existing?.originPlaceId)
  const [destinationId, setDestinationId] = useState(existing?.destinationPlaceId)

  const [remindBefore, setRemindBefore] = useState(
    existing?.reminders.checklistNudgeMinutes != null || isNew,
  )
  const [remindAtTime, setRemindAtTime] = useState(existing?.reminders.atDeparture ?? true)
  const [remindOnArrive, setRemindOnArrive] = useState(
    existing?.reminders.onArriveDestination ?? false,
  )

  const [reach, setReach] = useState<Reach>('needsAllow')
  const [saving, setSaving] = useState(false)

  // Show the honest capability state as soon as the screen opens.
  React.useEffect(() => {
    if (!notificationsAvailable()) {
      setReach('off')
      return
    }
    void readPermission().then((p) =>
      setReach(p === 'granted' ? 'closed' : p === 'denied' ? 'off' : 'needsAllow'),
    )
  }, [])

  const toggleList = useCallback((listId: string) => {
    setListIds((prev) =>
      prev.includes(listId) ? prev.filter((x) => x !== listId) : [...prev, listId],
    )
  }, [])

  /** Says what is missing, rather than leaving a dead button to be puzzled over. */
  const blockedReason = !name.trim() ? 'Give this day plan a name' : null

  const onDone = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)

    // Ask for permission only now — at the moment it is actually needed, never on launch.
    if (reach === 'needsAllow' && (remindBefore || remindAtTime)) {
      const granted = await requestPermission()
      setReach(granted === 'granted' ? 'closed' : 'off')
    }

    const now = Date.now()
    const routine: Routine = {
      id: existing?.id ?? newId(),
      name: trimmed,
      icon,
      enabled: existing?.enabled ?? true,
      days,
      startTime: time,
      originPlaceId: originId,
      destinationPlaceId: destinationId,
      checklistIds: listIds,
      reminders: {
        checklistNudgeMinutes: remindBefore && listIds.length > 0 ? 15 : undefined,
        atDeparture: remindAtTime,
        onArriveDestination: remindOnArrive && destinationId != null,
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    await applyRoutine(routine)
    refresh()
    setSaving(false)
    router.back()
  }, [
    name, icon, days, time, listIds, originId, destinationId,
    remindBefore, remindAtTime, remindOnArrive,
    existing, reach, saving, refresh, router,
  ])

  return (
    <>
    <Screen bottomInset={SAVE_BAR_CLEARANCE}>
      <DetailHeader title={isNew ? S.plan.addOne : (existing?.name ?? S.nav.dayPlans)} />

      {/* Name */}
      <Text variant="heading" style={styles.section}>What is it called?</Text>
      <View style={styles.chips}>
        {NAME_SUGGESTIONS.map((suggestion) => (
          <PressableScale
            key={suggestion}
            onPress={() => setName(suggestion)}
            depth="sm"
            accessibilityRole="button"
            accessibilityLabel={suggestion}
            style={[
              styles.chip,
              { backgroundColor: name === suggestion ? c.accentSoft : c.surfaceAlt },
            ]}
          >
            <Text variant="label" style={{ color: name === suggestion ? c.accent : c.inkMuted }}>
              {suggestion}
            </Text>
          </PressableScale>
        ))}
      </View>
      <Card tone="flat" padded={false} style={{ marginBottom: space.xl }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Work"
          placeholderTextColor={c.inkFaint}
          style={[styles.input, { color: c.ink }]}
          accessibilityLabel="What is it called?"
          returnKeyType="done"
        />
      </Card>

      {/* Picture */}
      <Text variant="heading" style={styles.section}>Picture</Text>
      <View style={{ marginBottom: space.xl }}>
        <IconPicker value={icon} onChange={(i) => setIcon(i)} set="plan" />
      </View>

      {/* Days */}
      <Text variant="heading" style={styles.section}>{S.plan.whichDays}</Text>
      <View style={{ marginBottom: space.xl }}>
        <DayPicker value={days} onChange={setDays} />
      </View>

      {/* Time */}
      <Text variant="heading" style={styles.section}>{S.plan.whatTime}</Text>
      <View style={{ marginBottom: space.xl }}>
        <TimePicker value={time} onChange={setTime} />
      </View>

      {/* Lists to take */}
      {checklists.length > 0 ? (
        <>
          <Text variant="heading" style={styles.section}>{S.plan.takeWith}</Text>
          <View style={{ gap: space.sm, marginBottom: space.xl }}>
            {checklists.map((list) => {
              const active = listIds.includes(list.id)
              return (
                <PressableScale
                  key={list.id}
                  onPress={() => toggleList(list.id)}
                  depth="sm"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={list.name}
                  style={[
                    styles.listRow,
                    { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
                  ]}
                >
                  <IconBadge
                    name={(list.icon as IconName) ?? 'list'}
                    plate={40}
                    size={20}
                    background={active ? c.accent : c.canvasDeep}
                    color={active ? c.onAccent : c.inkMuted}
                  />
                  <Text variant="body" style={{ flex: 1 }}>{list.name}</Text>
                  {active ? <Icon name="checkCircle" size={22} color={c.accent} /> : null}
                </PressableScale>
              )
            })}
          </View>
        </>
      ) : null}

      {/* Where — only offered once places exist, so the screen stays short for new users */}
      {places.length > 0 ? (
        <>
          <Text variant="heading" style={styles.section}>{S.plan.toWhere}</Text>
          <View style={styles.chips}>
            {places.map((p) => {
              const active = destinationId === p.id
              return (
                <PressableScale
                  key={p.id}
                  onPress={() => setDestinationId(active ? undefined : p.id)}
                  depth="sm"
                  accessibilityRole="button"
                  accessibilityLabel={p.name}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
                  ]}
                >
                  <Icon
                    name={(p.icon as IconName) ?? 'place'}
                    size={17}
                    color={active ? c.accent : c.inkFaint}
                  />
                  <Text variant="label" style={{ color: active ? c.accent : c.inkMuted }}>
                    {p.name}
                  </Text>
                </PressableScale>
              )
            })}
          </View>
        </>
      ) : null}

      {/* What DailyFlow should tell you */}
      <Text variant="heading" style={[styles.section, { marginTop: space.lg }]}>
        {S.plan.tellMe}
      </Text>
      <View style={{ gap: space.sm }}>
        {listIds.length > 0 ? (
          <Toggle
            label="Before I leave"
            help="A little early, so you can pack."
            icon="bag"
            value={remindBefore}
            onChange={setRemindBefore}
          />
        ) : null}
        <Toggle
          label="At the time"
          help="Time to go."
          icon="clock"
          value={remindAtTime}
          onChange={setRemindAtTime}
        />
        {destinationId ? (
          <Toggle
            label="When I get there"
            icon="arrive"
            value={remindOnArrive}
            onChange={setRemindOnArrive}
          />
        ) : null}
      </View>

      {/* The honest badge: what this phone will actually do */}
      <View style={{ marginTop: space.lg }}>
        <CapabilityBadge reach={reach} />
      </View>

      {!isNew && existing ? (
        <Button
          label={S.action.remove}
          icon="trash"
          variant="danger"
          full
          style={{ marginTop: space['3xl'] }}
          onPress={() => {
            void removeRoutineAndRules(existing.id).then(() => {
              refresh()
              router.back()
            })
          }}
        />
      ) : null}
    </Screen>

    <SaveBar
      label={isNew ? 'Add day plan' : 'Save day plan'}
      blockedReason={blockedReason}
      onPress={() => void onDone()}
    />
    </>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.xs, paddingHorizontal: space.xl,
    minHeight: 48, borderRadius: radius.pill,
  },
  input: { fontSize: font.base, paddingHorizontal: space.lg, paddingVertical: space.lg, minHeight: 52 },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderRadius: radius.lg, minHeight: 64,
  },
})
