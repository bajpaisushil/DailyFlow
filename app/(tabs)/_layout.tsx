import React from 'react'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BubbleTabBar } from '@/components/ui/BubbleTabBar'
import type { IconName } from '@/components/ui/Icon'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index', label: S.nav.today, icon: 'sun' },
  { name: 'places', label: S.nav.places, icon: 'place' },
  { name: 'plans', label: S.nav.dayPlans, icon: 'repeat' },
  { name: 'lists', label: S.nav.lists, icon: 'list' },
  { name: 'more', label: S.nav.more, icon: 'more' },
]

/**
 * The tab bar is fully custom (see BubbleTabBar) so navigation feels soft and buoyant
 * rather than like a segmented control. Order here defines order on screen.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const c = useColors()

  return (
    <Tabs
      tabBar={(props) => (
        <BubbleTabBar
          state={props.state}
          navigation={props.navigation}
          tabs={TABS}
          bottomInset={insets.bottom}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.canvas },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  )
}
