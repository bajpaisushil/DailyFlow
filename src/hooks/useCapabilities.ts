import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking } from 'react-native'
import { readCapability, requestBackground, requestForeground, type LocationCapability } from '@/lib/location/service'
import {
  notificationsAvailable, readPermission, requestPermission, type PermissionState,
} from '@/lib/notify/scheduler'
import { syncGeofences } from '@/lib/location/geofence'
import { resyncAll } from '@/lib/engine/apply'

/**
 * The app's honest view of what this phone will actually do.
 *
 * Read from the OS rather than remembered, and re-read whenever the app returns to the
 * foreground, because the user can revoke a permission in system settings at any time and
 * we must never keep claiming a capability we have lost (REQUIREMENTS.md #34/#36).
 */
export interface Capabilities {
  /** False when this build cannot schedule reminders at all (Expo Go). */
  canScheduleAtAll: boolean
  notifications: PermissionState
  location: LocationCapability
  /** True when reminders can reach the user with DailyFlow fully closed. */
  remindersWorkWhenClosed: boolean
  /** True when arriving/leaving is watched with DailyFlow fully closed. */
  placesWorkWhenClosed: boolean
}

const UNKNOWN: Capabilities = {
  canScheduleAtAll: true,
  notifications: 'undetermined',
  location: { foreground: 'undetermined', background: 'undetermined', servicesEnabled: false },
  remindersWorkWhenClosed: false,
  placesWorkWhenClosed: false,
}

export function useCapabilities() {
  const [caps, setCaps] = useState<Capabilities>(UNKNOWN)

  const refresh = useCallback(async () => {
    const [notifications, location] = await Promise.all([readPermission(), readCapability()])
    const canSchedule = notificationsAvailable()
    setCaps({
      canScheduleAtAll: canSchedule,
      notifications,
      location,
      remindersWorkWhenClosed: canSchedule && notifications === 'granted',
      placesWorkWhenClosed:
        canSchedule &&
        notifications === 'granted' &&
        location.foreground === 'granted' &&
        location.background === 'granted' &&
        location.servicesEnabled,
    })
  }, [])

  useEffect(() => {
    void refresh()
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

  /** Ask for reminders, then immediately hand the schedule to the OS. */
  const askForReminders = useCallback(async () => {
    const result = await requestPermission()
    if (result === 'granted') await resyncAll()
    await refresh()
    return result
  }, [refresh])

  /**
   * Location is a two-step ask: foreground first, then background. Requesting background
   * before foreground is granted is rejected or degraded on both platforms.
   */
  const askForPlaces = useCallback(async () => {
    const fg = await requestForeground()
    if (fg !== 'granted') {
      await refresh()
      return fg
    }
    const bg = await requestBackground()
    if (bg === 'granted') await syncGeofences()
    await refresh()
    return bg
  }, [refresh])

  /** When a permission was refused for good, the only route left is system settings. */
  const openPhoneSettings = useCallback(() => {
    void Linking.openSettings()
  }, [])

  return { caps, refresh, askForReminders, askForPlaces, openPhoneSettings }
}
