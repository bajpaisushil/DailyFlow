import 'react-native-gesture-handler'
// Importing the geofence module at the top level registers its background task during the
// cold start the OS performs when it delivers a region event. Registering it any later
// would mean missing the very event that woke us.
import '@/lib/location/geofence'

import React, { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'
import { seedIfFirstRun } from '@/lib/data/seed'
import { getDb } from '@/lib/db/sqlite'
import { boot } from '@/lib/engine/boot'

// The database opens synchronously, so the first screen renders with real data already in
// hand. There is no loading spinner anywhere in this app's startup path.
getDb()
seedIfFirstRun()

function Shell() {
  const { colors, scheme } = useTheme()

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.canvas },
          animation: 'slide_from_right',
          // Smoother, longer transitions to match the soft feel of the surfaces.
          animationDuration: 260,
          gestureEnabled: true,
          // Frees offscreen screens so scrolling never competes with a hidden render.
          freezeOnBlur: true,
        }}
      >
        <Stack.Screen name="(tabs)" />
        {/* Creating something is a modal: it is a self-contained task with a clear end, it
            gets a native swipe-to-dismiss for free, and it stops the create flows looking
            like another destination in the same flat hierarchy. */}
        <Stack.Screen name="place/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="plan/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="list/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  useEffect(() => {
    // Reconcile the OS-held schedule and geofences with our data on every cold start.
    void boot()
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Honour the OS reduce-motion setting globally, rather than per-animation.
            It configures Reanimated rather than wrapping the tree, so it is a sibling. */}
        <ReducedMotionConfig mode={ReduceMotion.System} />
        <ThemeProvider>
          <Shell />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
