import React from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated'
import { Card } from '@/components/ui/Card'
import { Text } from '@/components/ui/Text'
import { Icon, IconBadge, type IconName } from '@/components/ui/Icon'
import { PressableScale } from '@/components/ui/PressableScale'
import { radius, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'
import type { TodayChecklist } from '@/lib/today'

interface Props {
  entry: TodayChecklist
  onToggle: (itemId: string) => void
}

/**
 * "Take with you" — the single most-used control in the app, so ticking is one big tap
 * on the whole row rather than a small checkbox target.
 */
export function ChecklistCard({ entry, onToggle }: Props) {
  const c = useColors()
  const checked = new Set(entry.run?.checkedItemIds ?? [])
  const { checklist } = entry

  return (
    <Card style={{ marginBottom: space.lg }} padded={false}>
      <View style={styles.header}>
        <IconBadge
          name={(checklist.icon as IconName) ?? 'list'}
          background={entry.complete ? c.goodSoft : c.accentSoft}
          color={entry.complete ? c.good : c.accent}
        />
        <View style={styles.headerText}>
          <Text variant="heading">{checklist.name}</Text>
          <Text variant="caption" tone={entry.complete ? 'good' : 'muted'}>
            {entry.complete
              ? S.today.allPacked
              : `${entry.remaining} left`}
          </Text>
        </View>
      </View>

      <View style={styles.items}>
        {checklist.items.map((item) => {
          const isOn = checked.has(item.id)
          return (
            <Animated.View key={item.id} layout={LinearTransition.duration(180)}>
              <PressableScale
                depth="sm"
                onPress={() => onToggle(item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isOn }}
                accessibilityLabel={item.label}
                style={[styles.row, { borderColor: c.line }]}
              >
                <View
                  style={[
                    styles.box,
                    {
                      backgroundColor: isOn ? c.good : 'transparent',
                      borderColor: isOn ? c.good : c.lineStrong,
                    },
                  ]}
                >
                  {isOn ? (
                    <Animated.View entering={FadeIn.duration(140)}>
                      <Icon name="check" size={17} color={c.onAccent} />
                    </Animated.View>
                  ) : null}
                </View>

                {item.icon ? (
                  <Icon name={item.icon as IconName} size={19} color={isOn ? c.inkFaint : c.inkMuted} />
                ) : null}

                <Text
                  variant="body"
                  style={[
                    styles.label,
                    isOn && { color: c.inkFaint, textDecorationLine: 'line-through' },
                  ]}
                >
                  {item.label}
                </Text>

                {item.optional ? (
                  <Text variant="caption" tone="faint">
                    {S.list.nice}
                  </Text>
                ) : null}
              </PressableScale>
            </Animated.View>
          )
        })}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  headerText: { flex: 1, gap: 2 },
  items: { paddingHorizontal: space.md, paddingBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
  },
  box: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1 },
})
