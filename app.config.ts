import type { ExpoConfig } from 'expo/config'

/**
 * Dynamic app config.
 *
 * Exists so the Google Maps key can come from the environment rather than the repository.
 * The map is an optional enhancement — the place editor works through GPS and search
 * without it — so a missing key degrades the map rather than breaking the build.
 *
 * Set it before building:
 *   export GOOGLE_MAPS_API_KEY=...
 *   npx eas build --profile development --platform android
 *
 * iOS needs no key: expo-maps uses Apple Maps there.
 */
const config: ExpoConfig = {
    "name": "DailyFlow",
    "slug": "dailyflow",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "dailyflow",
    "userInterfaceStyle": "automatic",
        "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "app.dailyflow.personal",
      "infoPlist": {
        "NSLocationWhenInUseUsageDescription": "DailyFlow uses your location to know when you arrive at or leave your saved places, so it can remind you at the right moment. Your location never leaves this phone.",
        "NSLocationAlwaysAndWhenInUseUsageDescription": "DailyFlow watches your saved places in the background so reminders still work when the app is closed. Your location is only ever checked on this phone and is never sent anywhere.",
        "UIBackgroundModes": [
          "location",
          "fetch"
        ]
      }
    },
    "android": {
      "package": "app.dailyflow.personal",
      "adaptiveIcon": {
        "backgroundColor": "#0B0B12",
        "foregroundImage": "./assets/android-icon-foreground.png",
        "backgroundImage": "./assets/android-icon-background.png",
        "monochromeImage": "./assets/android-icon-monochrome.png"
      },
      "permissions": [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "POST_NOTIFICATIONS",
        "SCHEDULE_EXACT_ALARM",
        "USE_EXACT_ALARM",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "FOREGROUND_SERVICE",
        "FOREGROUND_SERVICE_LOCATION"
      ]
    },
    "plugins": [
      "./plugins/withReleaseSigning",
    "expo-router",
    [
      "expo-splash-screen",
      {
        "image": "./assets/splash-icon.png",
        "resizeMode": "contain",
        "backgroundColor": "#101319"
      }
    ],
      "expo-sqlite",
      "expo-sharing",
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "color": "#5B5BD6",
          "defaultChannel": "reminders"
        }
      ],
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "DailyFlow watches your saved places so reminders arrive at the right moment, even when the app is closed. Your location never leaves this phone.",
          "locationWhenInUsePermission": "DailyFlow uses your location to know when you arrive at or leave your saved places. Your location never leaves this phone.",
          "isAndroidBackgroundLocationEnabled": true
        }
      ],
      "expo-maps"
    ],
    "experiments": {
      "typedRoutes": true
    }
  }

const mapsKey = process.env.GOOGLE_MAPS_API_KEY
if (mapsKey && config.android) {
  config.android.config = { googleMaps: { apiKey: mapsKey } }
}

export default config
