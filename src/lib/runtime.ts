import Constants, { ExecutionEnvironment } from 'expo-constants'
import { Platform } from 'react-native'

/**
 * What this particular build can actually do.
 *
 * Expo Go is a shared sandbox app, not our app: it cannot register background tasks, so
 * geofencing genuinely does not work there, and its notification support is limited. That is
 * a real capability difference, and the honesty requirement means we detect and disclose it
 * rather than letting a reminder silently never arrive (REQUIREMENTS.md #34/#36).
 */

/** True when running inside Expo Go rather than a development or production build. */
export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient

/** Background geofencing needs a real build; Expo Go cannot register the task. */
export const supportsBackgroundGeofencing = !isExpoGo && Platform.OS !== 'web'

/**
 * Scheduled local notifications.
 *
 * Excludes Expo Go. The module throws the moment it is required there — SDK 53 removed
 * Android push from the sandbox app, and the error fires on import even though we only ever
 * want LOCAL notifications. A try/catch around the require does contain it, but the module
 * still logs on its way out, which produces a scary red error for something that is a known,
 * handled limitation. Not attempting the require is both quieter and more honest.
 */
export const supportsScheduledNotifications = !isExpoGo && Platform.OS !== 'web'

/**
 * Plain-words explanation for the one case a user can hit and be confused by. Everything
 * else the app can simply do; this is the only sentence we ever need to show about builds.
 */
export const EXPO_GO_LIMITATION =
  'You are using the Expo test app. Reminders need the real DailyFlow app.'
