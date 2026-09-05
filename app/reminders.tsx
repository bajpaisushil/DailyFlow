import React, { useMemo } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Screen } from '@/components/ui/Screen'
import { DetailHeader } from '@/components/ui/DetailHeader'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { Toggle } from '@/components/ui/Toggle'
import { useData } from '@/stores/data'
import { useSettings } from '@/stores/settings'
import { buildLookup, describeParts, LABELS } from '@/lib/engine/sentence'
import { resyncAll } from '@/lib/engine/apply'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * Every reminder, as sentences.
 *
 * This is the "advanced" surface, and it lives under More rather than in the tab bar
 * because most people should never need it — day plans generate these for them. Anyone who
 * does open it sees plain language, not a rule editor.
 */
export default function RemindersScreen() {
  const c = useColors()
  const automations = useData((s) => s.automations)
  const places = useData((s) => s.places)
  const checklists = useData((s) => s.checklists)
  const routines = useData((s) => s.routines)
  const saveAutomation = useData((s) => s.saveAutomation)

  const use24h = useSettings((s) => s.settings.use24HourClock)
  const locale = useSettings((s) => s.settings.locale)

  const lookup = useMemo(
    () => buildLookup({ places, checklists, routines }),
    [places, checklists, routines],
  )

  return (
    <Screen>
      <DetailHeader title={S.reminder.title} />

      {automations.length === 0 ? (
        <EmptyState icon="bell" title={S.reminder.empty} help={S.reminder.emptyHelp} />
      ) : (
        automations.map((automation, i) => {
          const parts = describeParts(automation, lookup, { use24h, locale })
          const sourceName = automation.sourceRoutineId
            ? routines.find((r) => r.id === automation.sourceRoutineId)?.name
            : undefined

          return (
            <Animated.View key={automation.id} entering={FadeInDown.delay(Math.min(i, 5) * 28).springify().damping(18).stiffness(140)}>
              <Card style={{ marginBottom: space.md, opacity: automation.enabled ? 1 : 0.55 }}>
                <View style={styles.header}>
                  <IconBadge name={(automation.icon as IconName) ?? 'bell'} plate={40} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text variant="heading">{automation.name}</Text>
                    {sourceName ? (
                      <Text variant="caption" tone="faint">
                        From your {sourceName} day plan
                      </Text>
                    ) : null}
                  </View>
                </View>

                <View style={styles.parts}>
                  <Part label={LABELS.when} value={parts.when} tint={c.accent} bg={c.accentSoft} />
                  {parts.onlyIf.map((line) => (
                    <Part key={line} label={LABELS.onlyIf} value={line} tint={c.warn} bg={c.warnSoft} />
                  ))}
                  {parts.then.map((line) => (
                    <Part key={line} label={LABELS.then} value={line} tint={c.good} bg={c.goodSoft} />
                  ))}
                </View>

                <View style={{ marginTop: space.md }}>
                  <Toggle
                    label={automation.enabled ? S.action.on : S.action.off}
                    value={automation.enabled}
                    onChange={(next) => {
                      saveAutomation({ ...automation, enabled: next })
                      void resyncAll()
                    }}
                  />
                </View>
              </Card>
            </Animated.View>
          )
        })
      )}
    </Screen>
  )
}

/** One chip of the sentence, colour-coded by role but always carrying its word. */
function Part({ label, value, tint, bg }: { label: string; value: string; tint: string; bg: string }) {
  return (
    <View style={[styles.part, { backgroundColor: bg }]}>
      <Text variant="label" style={{ color: tint, fontSize: 11.5,  letterSpacing: 0.7 }}>
        {label}
      </Text>
      <Text variant="body" style={{ flex: 1 }}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  parts: { gap: space.xs },
  part: {
    gap: 2,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
  },
})
