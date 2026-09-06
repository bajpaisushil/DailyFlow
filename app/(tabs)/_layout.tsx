import React from 'react'
import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BubbleTabBar } from '@/components/ui/BubbleTabBar'
import type { IconName } from '@/components/ui/Icon'
import { useColors } from '@/theme/ThemeProvider'
import { S } from '@/lib/strings'

/**
 * Four tabs, named after what a person wants rather than after the data model.
 *
 * The old set — Today, Places, Day plans, Lists — was four of my own nouns, and someone had
 * to understand and connect all of them before getting a single reminder. "Day plans" in
 * particular was an internal entity nobody would ever go looking for. Lists and day plans now
 * live under More, reachable when wanted and out of the way when not.
 */
const TABS: Array<{ name: string; label: string; icon: IconName }> = [
  { name: 'index', label: S.nav.today, icon: 'sun' },
  { name: 'reminders', label: S.nav.reminders, icon: 'bell' },
  { name: 'places', label: S.nav.places, icon: 'place' },
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
