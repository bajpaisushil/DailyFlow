import React, { useEffect, useState } from 'react'
import { View, StyleSheet, Pressable, AppState } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { Text } from '@/components/ui/Text'
import { Icon } from '@/components/ui/Icon'
import { alarmIsRinging, onAlarmRingingChange, stopAlarm } from '@/lib/notify/alarm'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

/**
 * A Stop button that follows the user everywhere while an alarm is sounding.
 *
 * It exists because there was no way to silence an alarm from inside the app at all. The only
 * Stop in the whole product lived on the full-screen alarm screen, and Android shows that
 * screen only when the phone is LOCKED — the moment someone is holding their phone, the
 * full-screen intent degrades to a heads-up notification. Someone whose alarm went off while
 * they were using their phone, or who dismissed the alarm screen with Back, had nothing.
 *
 * Rendered above the navigator so it survives every screen change: an alarm is not something
 * you should have to navigate to in order to turn off.
 */
export function RingingBanner() {
  const c = useColors()
  const insets = useSafeAreaInsets()
  const [ringing, setRinging] = useState(false)

  useEffect(() => {
    // The state at mount matters as much as the events: the app is very often opened BECAUSE
    // an alarm is ringing, which means the event fired long before this was listening.
    setRinging(alarmIsRinging())
    const unsubscribe = onAlarmRingingChange(setRinging)

    /**
     * Re-read when the app comes back to the foreground. An alarm can start, or be stopped
     * from the notification, while the JS engine is asleep and delivering no events.
     */
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') setRinging(alarmIsRinging())
    })

    return () => {
      unsubscribe()
      appState.remove()
    }
  }, [])

  if (!ringing) return null

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      pointerEvents="box-none"
      style={[styles.wrap, { top: insets.top + space.sm }]}
    >
      <View style={[styles.card, { backgroundColor: c.bad }]}>
        <Icon name="bell" size={22} color="#FFFFFF" />
        <Text variant="body" style={styles.label} numberOfLines={1}>
          Alarm is ringing
        </Text>
        <Pressable
          onPress={() => {
            stopAlarm()
            // Do not wait for the native event: the button must look like it worked the
            // instant it is pressed, and the event will confirm it a moment later.
            setRinging(false)
          }}
          accessibilityRole="button"
          accessibilityLabel="Stop the alarm"
          hitSlop={12}
          style={({ pressed }) => [
            styles.stop,
            { backgroundColor: '#FFFFFF', opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text variant="body" style={[styles.stopLabel, { color: c.bad }]}>Stop</Text>
        </Pressable>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    zIndex: 900,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderRadius: radius.xl,
    // Sits above everything, so it reads as an overlay rather than part of the screen.
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  label: { flex: 1, color: '#FFFFFF', fontWeight: '700' },
  stop: {
    minHeight: 44,
    minWidth: 92,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    paddingHorizontal: space.lg,
  },
  stopLabel: { fontWeight: '800' },
})
