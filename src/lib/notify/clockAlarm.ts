import { Linking, Platform } from 'react-native'
import { parseHHMM } from '@/lib/time'
import type { HHMM } from '@/lib/types'

/**
 * Setting a real alarm in the phone's own Clock app.
 *
 * An honest account of why this exists: what DailyFlow can schedule by itself is a
 * notification — a maximum-importance one on the alarm audio channel, which is loud and
 * vibrates hard, but which still behaves like a notification. It appears, it sounds once, and
 * it waits. It does not ring until you dismiss it, and it will not reliably wake someone who
 * is asleep.
 *
 * A true alarm needs a full-screen intent and a foreground service, which expo-notifications
 * does not expose. Rather than let the word "alarm" quietly mean something weaker than
 * everyone assumes, DailyFlow hands the job to the app built for it. The Clock app's alarms
 * ring until dismissed, survive reboots, ignore Do Not Disturb, and are not affected by any
 * battery optimisation applied to us.
 *
 * It costs nothing and needs no account: it is a standard Android intent, and the alarm is
 * created in the user's own Clock app where they can see and edit it.
 */

export function clockAlarmSupported(): boolean {
  return Platform.OS === 'android'
}

export interface ClockAlarmRequest {
  time: HHMM
  label: string
  /** 1 = Sunday … 7 = Saturday, matching the Android alarm intent. */
  weekdays?: number[]
}

/**
 * Ask the Clock app to create an alarm.
 *
 * Deliberately opens the Clock app's own screen rather than creating one silently: an app
 * that adds alarms to your phone without showing you is an app people uninstall. The user
 * sees exactly what is being set and confirms it.
 */
export async function setClockAlarm(request: ClockAlarmRequest): Promise<boolean> {
  if (!clockAlarmSupported()) return false

  const minutes = parseHHMM(request.time)
  if (minutes == null) return false

  try {
    await Linking.sendIntent('android.intent.action.SET_ALARM', [
      { key: 'android.intent.extra.alarm.HOUR', value: Math.floor(minutes / 60) },
      { key: 'android.intent.extra.alarm.MINUTES', value: minutes % 60 },
      { key: 'android.intent.extra.alarm.MESSAGE', value: request.label },
      // Never skip the confirmation screen. See the note above.
      { key: 'android.intent.extra.alarm.SKIP_UI', value: false },
    ])
    return true
  } catch {
    // No Clock app that accepts the intent, or the OS refused it.
    return false
  }
}
