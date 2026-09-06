import React, { useCallback, useMemo, useState } from 'react'
import { View, StyleSheet, TextInput } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { Button } from '@/components/ui/Button'
import { Toggle } from '@/components/ui/Toggle'
import { DayPicker } from '@/components/ui/DayPicker'
import { TimePicker } from '@/components/ui/TimePicker'
import { IconPicker } from '@/components/ui/IconPicker'
import { CapabilityBadge, type Reach } from '@/components/ui/CapabilityBadge'
import { SaveBar, SAVE_BAR_CLEARANCE } from '@/components/ui/SaveBar'
import { LeadTimePicker } from '@/components/reminders/LeadTimePicker'
import { SoundPicker } from '@/components/reminders/SoundPicker'
import type { ToneId } from '@/lib/notify/tones'
import { speak, reminderSpeech } from '@/lib/notify/speak'
import { useData } from '@/stores/data'
import { newId } from '@/lib/id'
import { applyReminder, removeReminder } from '@/lib/engine/applyReminder'
import { notificationsAvailable, readPermission, requestPermission } from '@/lib/notify/scheduler'
import type { AlertStyle, NotificationPriority, PlaceTrigger, Reminder, Weekday } from '@/lib/types'
import { formatTime, WEEKDAYS_MON_FRI } from '@/lib/time'
import { describeCourse, endDateAfterDays, occurrenceCount } from '@/lib/course'
import { clockAlarmSupported, setClockAlarm } from '@/lib/notify/clockAlarm'
import { describeApproach } from '@/lib/location/approach'
import { useSettings } from '@/stores/settings'
import { font, radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * The reminder editor — the screen the whole app now revolves around.
 *
 * It replaces the old arrangement, where a person had to understand Places, Day plans, Lists
 * and Automations and connect them before getting one reminder. Here the questions are the
 * ones anyone would ask out loud: what should I be told, when, how early, how loudly.
 *
 * A reminder can carry SEVERAL times and SEVERAL places at once, which is the thing the old
 * model could not express at all.
 */

const TITLE_SUGGESTIONS = [
  'Take my medicine', 'Leave for work', 'Leave for temple',
  'Drink water', 'Call home', 'Pick up the kids',
]

export default function ReminderEditor() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const c = useColors()

  const reminders = useData((s) => s.reminders)
  const places = useData((s) => s.places)
  const checklists = useData((s) => s.checklists)
  const refresh = useData((s) => s.refresh)

  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)

  const isNew = id === 'new'
  const existing = useMemo(() => reminders.find((r) => r.id === id), [reminders, id])

  const [title, setTitle] = useState(existing?.title ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? 'bell')
  const [times, setTimes] = useState<string[]>(existing?.times ?? [])
  const [days, setDays] = useState<Weekday[]>(existing?.days ?? WEEKDAYS_MON_FRI)
  const [leads, setLeads] = useState<number[]>(existing?.leadMinutes ?? [0])
  const [placeTriggers, setPlaceTriggers] = useState<PlaceTrigger[]>(existing?.placeTriggers ?? [])
  const [checklistId, setChecklistId] = useState(existing?.checklistId)
  const [priority, setPriority] = useState<NotificationPriority>(existing?.priority ?? 'normal')
  const [vibrate, setVibrate] = useState(existing?.vibrate ?? true)
  const [alertStyle, setAlertStyle] = useState<AlertStyle>(existing?.alertStyle ?? 'notification')
  const [endsOn, setEndsOn] = useState(existing?.endsOn)
  const [toneId, setToneId] = useState<ToneId>((existing?.toneId as ToneId) ?? 'chime')
  const [soundFile, setSoundFile] = useState(existing?.soundFile)
  const [soundLabel, setSoundLabel] = useState(existing?.soundLabel)
  const [speakAloud, setSpeakAloud] = useState(existing?.speakAloud ?? false)
  const [sound, setSound] = useState(existing?.sound ?? true)

  const [addingTime, setAddingTime] = useState(false)
  const [draftTime, setDraftTime] = useState('08:00')
  /** The time currently being changed, or null when adding a new one. */
  const [editingTime, setEditingTime] = useState<string | null>(null)
  const [reach, setReach] = useState<Reach>('needsAllow')
  const [saving, setSaving] = useState(false)

  React.useEffect(() => {
    if (!notificationsAvailable()) {
      // Not "off" — there is no switch to find. Saying so prevents a hunt through settings.
      setReach('unavailable')
      return
    }
    void readPermission().then((p) =>
      setReach(p === 'granted' ? 'closed' : p === 'denied' ? 'off' : 'needsAllow'),
    )
  }, [])

  const togglePlace = useCallback((placeId: string, on: 'arrive' | 'leave') => {
    setPlaceTriggers((prev) => {
      const found = prev.find((t) => t.placeId === placeId && t.on === on)
      if (found) return prev.filter((t) => t !== found)
      return [...prev, { id: newId(), placeId, on }]
    })
  }, [])

  /** How far ahead of arriving to warn — "wake me six minutes before my stop". */
  const setApproach = useCallback((placeId: string, minutes: number | undefined) => {
    // No speed is stored: the app works out how fast the user travels from GPS, so the only
    // thing worth asking is how much warning they want.
    setPlaceTriggers((prev) =>
      prev.map((t) =>
        t.placeId === placeId && t.on === 'arrive' ? { ...t, approachMinutes: minutes } : t,
      ),
    )
  }, [])

  /** Says what is missing, rather than leaving a dead button to be puzzled over. */
  const blockedReason =
    title.trim().length === 0
      ? 'Say what you want to be reminded about'
      : times.length === 0 && placeTriggers.length === 0
        ? 'Add a time, or a place to be reminded at'
        : null
  const canSave = blockedReason == null

  const onDone = useCallback(async () => {
    if (!canSave || saving) return
    setSaving(true)

    // Permission is asked here — at the moment it is finally needed — never on launch.
    if (reach === 'needsAllow') {
      const granted = await requestPermission()
      setReach(granted === 'granted' ? 'closed' : 'off')
    }

    const now = Date.now()
    const doc: Reminder = {
      id: existing?.id ?? newId(),
      title: title.trim(),
      icon,
      enabled: existing?.enabled ?? true,
      times,
      days,
      endsOn,
      placeTriggers,
      leadMinutes: leads,
      checklistId,
      priority,
      alertStyle,
      toneId,
      soundFile,
      soundLabel,
      speakAloud,
      sound,
      vibrate,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    await applyReminder(doc)
    refresh()
    setSaving(false)
    router.back()
  }, [
    canSave, saving, reach, existing, title, icon, times, days,
    placeTriggers, leads, checklistId, priority, alertStyle, toneId, soundFile, soundLabel,
    speakAloud, sound, vibrate, endsOn, refresh, router,
  ])

  return (
    <>
    <Screen bottomInset={SAVE_BAR_CLEARANCE}>
      <DetailHeader title={isNew ? 'New reminder' : (existing?.title ?? 'Reminder')} />

      {/* 1 — What should it say */}
      <Text variant="heading" style={styles.section}>What should I remind you about?</Text>
      <View style={styles.chips}>
        {TITLE_SUGGESTIONS.map((t) => (
          <PressableScale
            key={t}
            onPress={() => setTitle(t)}
            depth="sm"
            accessibilityRole="button"
            accessibilityLabel={t}
            style={[
              styles.chip,
              { backgroundColor: title === t ? c.accentSoft : c.surfaceAlt },
            ]}
          >
            <Text variant="label" style={{ color: title === t ? c.accent : c.inkMuted }}>{t}</Text>
          </PressableScale>
        ))}
      </View>
      <Card tone="flat" padded={false} style={{ marginBottom: space.xl }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Take my medicine"
          placeholderTextColor={c.inkFaint}
          style={[styles.input, { color: c.ink }]}
          accessibilityLabel="What should I remind you about?"
          returnKeyType="done"
        />
      </Card>

      {/* 2 — When: times */}
      <Text variant="heading" style={styles.section}>At what time?</Text>
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        {times.map((t) => (
          <Animated.View key={t} layout={LinearTransition.duration(180)} entering={FadeIn}>
            {/* The whole row opens the picker. Without this, changing 9:00 to 9:15 meant
                deleting the time and adding it again. */}
            <PressableScale
              depth="sm"
              onPress={() => {
                setEditingTime(t)
                setDraftTime(t)
                setAddingTime(true)
              }}
              accessibilityRole="button"
              accessibilityLabel={`${formatTime(t, use24h, locale)}. Tap to change.`}
              style={[styles.timeRow, { backgroundColor: c.surfaceAlt }]}
            >
              <IconBadge name="clock" plate={40} size={20} />
              <Text variant="body" style={{ flex: 1 }}>{formatTime(t, use24h, locale)}</Text>
              <Text variant="label" style={{ color: c.accent }}>Change</Text>
              <PressableScale
                onPress={() => setTimes((prev) => prev.filter((x) => x !== t))}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${formatTime(t, use24h, locale)}`}
                style={styles.removeBtn}
              >
                <Icon name="close" size={20} color={c.inkFaint} />
              </PressableScale>
            </PressableScale>
          </Animated.View>
        ))}

        {addingTime ? (
          <Card tone="flat">
            <TimePicker value={draftTime} onChange={setDraftTime} />
            <View style={styles.addActions}>
              <Button
                label={S.action.goBack}
                variant="quiet"
                onPress={() => {
                  setAddingTime(false)
                  setEditingTime(null)
                }}
              />
              <Button
                label={editingTime ? S.action.done : S.action.add}
                icon="check"
                onPress={() => {
                  setTimes((prev) => {
                    // Editing replaces the original; adding just appends.
                    const without = editingTime ? prev.filter((x) => x !== editingTime) : prev
                    return [...new Set([...without, draftTime])].sort()
                  })
                  setAddingTime(false)
                  setEditingTime(null)
                }}
              />
            </View>
          </Card>
        ) : (
          <Button
            label={times.length === 0 ? 'Add a time' : 'Add another time'}
            icon="plus"
            variant="secondary"
            full
            onPress={() => {
              setEditingTime(null)
              setDraftTime('08:00')
              setAddingTime(true)
            }}
          />
        )}
      </View>

      {/* Days only matter once there is a time */}
      {times.length > 0 ? (
        <>
          <Text variant="heading" style={styles.section}>On which days?</Text>
          <View style={{ marginBottom: space.xl }}>
            <DayPicker value={days} onChange={setDays} />
          </View>

          <Text variant="heading" style={styles.section}>For how long?</Text>
          <View style={styles.chips}>
            {([
              { label: 'Keep going', days: 0 },
              { label: '3 days', days: 3 },
              { label: '1 week', days: 7 },
              { label: '2 weeks', days: 14 },
              { label: '1 month', days: 30 },
            ] as const).map((option) => {
              const value = option.days === 0 ? undefined : endDateAfterDays(new Date(), option.days)
              const active = option.days === 0 ? !endsOn : endsOn === value
              return (
                <PressableScale
                  key={option.label}
                  onPress={() => setEndsOn(value)}
                  depth="sm"
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                  style={[styles.chip, { backgroundColor: active ? c.accent : c.surfaceAlt }]}
                >
                  <Text variant="label" style={{ color: active ? c.onAccent : c.inkMuted }}>
                    {option.label}
                  </Text>
                </PressableScale>
              )
            })}
          </View>
          {endsOn ? (
            <Text variant="caption" tone="muted" style={{ marginBottom: space.xl }}>
              {describeCourse({ times, endsOn })}
              {'. '}
              {occurrenceCount({ times, days, endsOn, leadMinutes: leads }, new Date())} reminders in total.
            </Text>
          ) : (
            <View style={{ marginBottom: space.xl }} />
          )}

          <Text variant="heading" style={styles.section}>How early should I tell you?</Text>
          <View style={{ marginBottom: space.xl }}>
            <LeadTimePicker value={leads} onChange={setLeads} />
          </View>
        </>
      ) : null}

      {/* 3 — When: places */}
      <Text variant="heading" style={styles.section}>Or when you reach or leave a place</Text>
      {places.length === 0 ? (
        <Card tone="flat" style={{ marginBottom: space.xl }}>
          <Text variant="caption" tone="muted">
            You have not saved any places yet. Add one to be reminded when you get there.
          </Text>
          <Button
            label={S.place.addOne}
            icon="plus"
            variant="secondary"
            full
            style={{ marginTop: space.md }}
            onPress={() => router.push('/place/new')}
          />
        </Card>
      ) : (
        <View style={{ gap: space.sm, marginBottom: space.xl }}>
          {places.map((place) => {
            const arriving = placeTriggers.some((t) => t.placeId === place.id && t.on === 'arrive')
            const leaving = placeTriggers.some((t) => t.placeId === place.id && t.on === 'leave')
            return (
              <Card key={place.id} tone="flat" padded={false} style={styles.placeCard}>
                <View style={styles.placeHead}>
                  <IconBadge name={(place.icon as IconName) ?? 'place'} plate={40} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text variant="body">{place.name}</Text>
                    {place.address ? (
                      <Text variant="caption" tone="muted" numberOfLines={1}>{place.address}</Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.placeActions}>
                  <PlaceToggle
                    label="When I arrive"
                    icon="arrive"
                    active={arriving}
                    onPress={() => togglePlace(place.id, 'arrive')}
                  />
                  <PlaceToggle
                    label="When I leave"
                    icon="leave"
                    active={leaving}
                    onPress={() => togglePlace(place.id, 'leave')}
                  />
                </View>

                {/* Warn BEFORE arriving. Not a time offset — there is no clock time to
                    subtract from — but a bigger circle around the place. Speed is asked
                    because six minutes of walking and six on a metro are very different
                    distances. */}
                {arriving ? (
                  <View style={styles.approach}>
                    <Text variant="caption" tone="muted">Tell me before I get there</Text>
                    <View style={styles.chips}>
                      {[undefined, 2, 5, 6, 10].map((minutes) => {
                        const trigger = placeTriggers.find(
                          (t) => t.placeId === place.id && t.on === 'arrive',
                        )
                        const active = (trigger?.approachMinutes ?? undefined) === minutes
                        return (
                          <PressableScale
                            key={String(minutes)}
                            onPress={() => setApproach(place.id, minutes)}
                            depth="sm"
                            accessibilityRole="radio"
                            accessibilityState={{ selected: active }}
                            accessibilityLabel={minutes ? `${minutes} minutes before` : 'On arrival'}
                            style={[
                              styles.smallChip,
                              { backgroundColor: active ? c.accent : c.canvasDeep },
                            ]}
                          >
                            <Text
                              variant="label"
                              style={{ color: active ? c.onAccent : c.inkMuted, fontSize: 13 }}
                            >
                              {minutes ? `${minutes} min` : 'On arrival'}
                            </Text>
                          </PressableScale>
                        )
                      })}
                    </View>

                    {placeTriggers.find((t) => t.placeId === place.id && t.on === 'arrive')
                      ?.approachMinutes ? (
                      <Text variant="caption" tone="faint">
                        {describeApproach(
                          placeTriggers.find(
                            (t) => t.placeId === place.id && t.on === 'arrive',
                          )!,
                          place.radiusM,
                          place,
                        )}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            )
          })}
        </View>
      )}

      {/* 4 — What to take */}
      {checklists.length > 0 ? (
        <>
          <Text variant="heading" style={styles.section}>Remind you to take something?</Text>
          <View style={{ gap: space.sm, marginBottom: space.xl }}>
            {checklists.map((list) => {
              const active = checklistId === list.id
              return (
                <PressableScale
                  key={list.id}
                  onPress={() => setChecklistId(active ? undefined : list.id)}
                  depth="sm"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={list.name}
                  style={[
                    styles.listRow,
                    { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
                  ]}
                >
                  <IconBadge name={(list.icon as IconName) ?? 'list'} plate={40} size={20} />
                  <Text variant="body" style={{ flex: 1 }}>{list.name}</Text>
                  {active ? <Icon name="checkCircle" size={22} color={c.accent} /> : null}
                </PressableScale>
              )
            })}
          </View>
        </>
      ) : null}

      {/* 5 — How loud */}
      <Text variant="heading" style={styles.section}>How should it reach you?</Text>
      <View style={{ gap: space.sm, marginBottom: space.lg }}>
        {/* An alarm is for the case where sleeping through it defeats the point — waking
            before your stop, or medicine that cannot be missed. */}
        <View style={styles.styleRow}>
          {([
            { key: 'notification' as const, label: 'A message', icon: 'bell' as const,
              help: 'A normal reminder' },
            { key: 'alarm' as const, label: 'An alarm', icon: 'clock' as const,
              help: 'Loud, to wake you' },
          ]).map((option) => {
            const active = alertStyle === option.key || alertStyle === 'both'
            return (
              <PressableScale
                key={option.key}
                onPress={() => {
                  // Both are independently selectable. Choosing both means the early
                  // warnings stay quiet and only the one at the real moment rings.
                  const other = option.key === 'alarm' ? 'notification' : 'alarm'
                  if (alertStyle === 'both') setAlertStyle(other)
                  else if (alertStyle === option.key) setAlertStyle(option.key)
                  else setAlertStyle('both')
                }}
                depth="sm"
                accessibilityRole="checkbox"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.label}. ${option.help}`}
                style={{ flex: 1 }}
              >
                <Card tone={active ? 'raised' : 'flat'} style={[
                  styles.styleCard,
                  active && { backgroundColor: c.accentSoft },
                ]}>
                  <IconBadge
                    name={option.icon}
                    plate={44}
                    size={22}
                    background={active ? c.accent : undefined}
                    color={active ? c.onAccent : undefined}
                  />
                  <Text variant="heading" style={{ color: active ? c.accent : c.ink }}>
                    {option.label}
                  </Text>
                  <Text variant="caption" tone="muted">{option.help}</Text>
                </Card>
              </PressableScale>
            )
          })}
        </View>

        {/* Says what an alarm here actually is. Calling a loud notification an "alarm"
            without qualification is the kind of small dishonesty that gets someone to their
            stop late, so the difference is stated and the real thing is offered. */}
        {(alertStyle === 'alarm' || alertStyle === 'both') && clockAlarmSupported() ? (
          <Card tone="flat" style={{ marginBottom: space.sm }}>
            <Text variant="caption" tone="muted">
              DailyFlow&apos;s alarm is loud and vibrates, but it sounds once — it will not
              ring until you turn it off. For something you must not sleep through, also set
              it in your phone&apos;s Clock.
            </Text>
            <Button
              label="Also set a Clock alarm"
              icon="clock"
              variant="secondary"
              full
              style={{ marginTop: space.md }}
              disabled={times.length === 0}
              onPress={() => {
                const first = times[0]
                if (first) void setClockAlarm({ time: first, label: title.trim() || 'DailyFlow' })
              }}
            />
          </Card>
        ) : null}

        <Toggle label="Make a sound" icon="speak" value={sound} onChange={setSound} />

        {sound ? (
          <View style={{ marginTop: space.xs }}>
            <SoundPicker
              toneId={toneId}
              onToneChange={setToneId}
              soundFile={soundFile}
              soundLabel={soundLabel}
              onCustomChange={(file, label) => {
                setSoundFile(file)
                setSoundLabel(label)
              }}
            />
          </View>
        ) : null}

        {/* Reading it out is the most useful thing in this screen for someone who reads
            slowly — hearing "take your medicine" is easier than decoding it. */}
        <Toggle
          label="Read it out loud"
          help="DailyFlow speaks the reminder. Works while the app is open."
          icon="mic"
          value={speakAloud}
          onChange={(next) => {
            setSpeakAloud(next)
            if (next) void speak(reminderSpeech(title.trim() || 'Your reminder'))
          }}
        />
        <Toggle label={S.settings.vibrate} icon="phone" value={vibrate} onChange={setVibrate} />
        <Toggle
          label={S.reminder.important}
          help={S.reminder.importantHelp}
          icon="bell"
          value={priority === 'important'}
          onChange={(v) => setPriority(v ? 'important' : 'normal')}
        />
      </View>

      <CapabilityBadge reach={reach} />

      {!isNew && existing ? (
        <Button
          label={S.action.remove}
          icon="trash"
          variant="danger"
          full
          style={{ marginTop: space['3xl'] }}
          onPress={() => {
            void removeReminder(existing.id).then(() => {
              refresh()
              router.back()
            })
          }}
        />
      ) : null}
    </Screen>

    <SaveBar
      label={isNew ? 'Add reminder' : 'Save changes'}
      blockedReason={blockedReason}
      busy={saving}
      onPress={() => void onDone()}
    />
    </>
  )
}

function PlaceToggle({
  label, icon, active, onPress,
}: {
  label: string
  icon: IconName
  active: boolean
  onPress: () => void
}) {
  const c = useColors()
  return (
    <PressableScale
      onPress={onPress}
      depth="sm"
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={[
        styles.placeToggle,
        { backgroundColor: active ? c.accent : c.canvasDeep },
      ]}
    >
      <Icon name={icon} size={18} color={active ? c.onAccent : c.inkMuted} />
      <Text variant="label" style={{ color: active ? c.onAccent : c.inkMuted, fontSize: 13 }}>
        {label}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md },
  chip: {
    paddingHorizontal: space.lg, minHeight: 46, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  input: { fontSize: font.base, paddingHorizontal: space.lg, paddingVertical: space.lg, minHeight: 54 },
  timeRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderRadius: radius.lg, minHeight: 64,
  },
  removeBtn: { width: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  addActions: { flexDirection: 'row', gap: space.sm, marginTop: space.lg, justifyContent: 'flex-end' },
  placeCard: { paddingVertical: space.md },
  placeHead: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, marginBottom: space.sm,
  },
  placeActions: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  placeToggle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.xs, minHeight: 46, borderRadius: radius.pill,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    borderRadius: radius.lg, minHeight: 64,
  },
  approach: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  smallChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md, minHeight: 40, borderRadius: radius.pill,
  },
  styleRow: { flexDirection: 'row', gap: space.md, marginBottom: space.sm },
  styleCard: { alignItems: 'flex-start', gap: space.sm, minHeight: 140 },
})
