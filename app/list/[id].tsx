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
import { IconPicker } from '@/components/ui/IconPicker'
import { useData } from '@/stores/data'
import { newId } from '@/lib/db/repo'
import type { Checklist, ChecklistItem } from '@/lib/types'
import { space, radius, font } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * List editor. Handles both "new" and an existing id through the same route, because a
 * separate create screen would duplicate every control for no benefit.
 */
export default function ListEditor() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const c = useColors()

  const checklists = useData((s) => s.checklists)
  const saveChecklist = useData((s) => s.saveChecklist)
  const removeChecklist = useData((s) => s.removeChecklist)

  const isNew = id === 'new'
  const existing = useMemo(() => checklists.find((l) => l.id === id), [checklists, id])

  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState<string>(existing?.icon ?? 'list')
  const [items, setItems] = useState<ChecklistItem[]>(existing?.items ?? [])
  const [draft, setDraft] = useState('')

  const addItem = useCallback(() => {
    const label = draft.trim()
    if (!label) return
    setItems((prev) => [
      ...prev,
      { id: newId(), label, order: prev.length, icon: guessIcon(label) },
    ])
    setDraft('')
  }, [draft])

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId))
  }, [])

  const toggleOptional = useCallback((itemId: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, optional: !i.optional } : i)),
    )
  }, [])

  const onDone = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) return
    const now = Date.now()
    const doc: Checklist = {
      ...(existing ?? {}),
      id: existing?.id ?? newId(),
      name: trimmed,
      icon,
      items: items.map((it, i) => ({ ...it, order: i })),
      resetRule: existing?.resetRule ?? { kind: 'daily' },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    saveChecklist(doc)
    router.back()
  }, [name, icon, items, existing, saveChecklist, router])

  return (
    <Screen>
      <DetailHeader
        title={isNew ? S.list.addOne : (existing?.name ?? S.nav.lists)}
        onDone={onDone}
        disabled={!name.trim()}
      />

      {/* Name */}
      <Text variant="heading" style={styles.section}>{S.place.nameIt}</Text>
      <Card tone="flat" padded={false} style={{ marginBottom: space.xl }}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Work bag"
          placeholderTextColor={c.inkFaint}
          style={[styles.input, { color: c.ink }]}
          accessibilityLabel={S.place.nameIt}
          returnKeyType="done"
        />
      </Card>

      {/* Picture */}
      <Text variant="heading" style={styles.section}>Picture</Text>
      <View style={{ marginBottom: space.xl }}>
        <IconPicker value={icon} onChange={(i) => setIcon(i)} set="thing" />
      </View>

      {/* Things */}
      <Text variant="heading" style={styles.section}>{S.list.things}</Text>
      <Card padded={false} style={{ paddingVertical: space.sm, marginBottom: space.lg }}>
        {items.length === 0 ? (
          <Text variant="caption" tone="faint" center style={{ padding: space.xl }}>
            {S.list.emptyHelp}
          </Text>
        ) : (
          items.map((item) => (
            <Animated.View key={item.id} layout={LinearTransition.duration(180)} entering={FadeIn}>
              <View style={styles.itemRow}>
                <IconBadge
                  name={(item.icon as IconName) ?? 'list'}
                  plate={38}
                  size={19}
                  background={c.canvasDeep}
                  color={c.inkMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="body">{item.label}</Text>
                  <PressableScale
                    onPress={() => toggleOptional(item.id)}
                    haptic={false}
                    style={styles.optionalToggle}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: !!item.optional }}
                  >
                    <Text variant="caption" tone={item.optional ? 'muted' : 'accent'}>
                      {item.optional ? S.list.nice : S.list.mustHave}
                    </Text>
                  </PressableScale>
                </View>
                <PressableScale
                  onPress={() => removeItem(item.id)}
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={`${S.action.remove} ${item.label}`}
                >
                  <Icon name="close" size={20} color={c.inkFaint} />
                </PressableScale>
              </View>
            </Animated.View>
          ))
        )}
      </Card>

      {/* Add a thing */}
      <Card tone="flat" padded={false} style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={addItem}
          placeholder={S.list.addThing}
          placeholderTextColor={c.inkFaint}
          style={[styles.input, { color: c.ink, flex: 1 }]}
          accessibilityLabel={S.list.addThing}
          returnKeyType="done"
        />
        <PressableScale
          onPress={addItem}
          style={[styles.addBtn, { backgroundColor: draft.trim() ? c.accent : c.canvasDeep }]}
          accessibilityRole="button"
          accessibilityLabel={S.action.add}
        >
          <Icon name="plus" size={22} color={draft.trim() ? c.onAccent : c.inkFaint} />
        </PressableScale>
      </Card>

      {!isNew && existing ? (
        <Button
          label={S.action.remove}
          icon="trash"
          variant="danger"
          full
          style={{ marginTop: space['3xl'] }}
          onPress={() => {
            removeChecklist(existing.id)
            router.back()
          }}
        />
      ) : null}
    </Screen>
  )
}

/** Best-effort picture for a typed word, so most items get an icon with no extra tap. */
function guessIcon(label: string): IconName {
  const l = label.toLowerCase()
  const table: Array<[RegExp, IconName]> = [
    [/phone|mobile/, 'phone'], [/key/, 'keys'], [/wallet|purse|money|cash/, 'wallet'],
    [/card|id|badge|licen/, 'card'], [/laptop|computer|pc/, 'laptop'],
    [/charg|cable|plug|power/, 'charger'], [/bag|backpack/, 'bag'],
    [/bottle|water|flask/, 'bottle'], [/earphone|headphone|earbud/, 'earphones'],
    [/shoe|sneaker|boot/, 'shoes'], [/towel/, 'towel'],
    [/medic|pill|tablet|drug/, 'pills'], [/umbrella|rain/, 'umbrella'],
    [/book|note/, 'book'], [/passport/, 'passport'], [/ticket|pass/, 'ticket'],
    [/food|lunch|tiffin|snack/, 'food'],
  ]
  for (const [re, icon] of table) if (re.test(l)) return icon
  return 'list'
}

const styles = StyleSheet.create({
  section: { marginBottom: space.sm },
  input: { fontSize: font.base, paddingHorizontal: space.lg, paddingVertical: space.lg, minHeight: 52 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  optionalToggle: { minHeight: 26, justifyContent: 'center' },
  remove: { width: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'center', paddingRight: space.sm },
  addBtn: {
    width: 48, height: 48, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
})
