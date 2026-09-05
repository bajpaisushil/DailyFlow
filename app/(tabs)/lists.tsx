import React from 'react'
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
import { space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/** Lists (checklists). Reusable things to take or do. */
export default function ListsScreen() {
  const router = useRouter()
  const c = useColors()
  const checklists = useData((s) => s.checklists)

  return (
    <Screen>
      <ScreenHeader
        title={S.nav.lists}
        help={S.list.help}
        onAdd={() => router.push('/list/new')}
        addLabel={S.list.addOne}
      />

      {checklists.length === 0 ? (
        <EmptyState
          icon="list"
          title={S.list.empty}
          help={S.list.emptyHelp}
          actionLabel={S.list.addOne}
          onAction={() => router.push('/list/new')}
        />
      ) : (
        checklists.map((list, i) => (
          <Animated.View key={list.id} entering={FadeInDown.delay(i * 40).duration(300)}>
            <PressableScale onPress={() => router.push(`/list/${list.id}`)} depth="sm">
              <Card style={styles.card}>
                <IconBadge name={(list.icon as IconName) ?? 'list'} />
                <View style={styles.text}>
                  <Text variant="heading">{list.name}</Text>
                  <Text variant="caption" tone="muted">
                    {list.items.length === 1 ? '1 thing' : `${list.items.length} things`}
                  </Text>
                </View>
                <Icon name="forward" size={20} color={c.inkFaint} />
              </Card>
            </PressableScale>
          </Animated.View>
        ))
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  text: { flex: 1, gap: 2 },
})
