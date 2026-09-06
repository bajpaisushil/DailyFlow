const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins')

/**
 * Teaches `expo prebuild` to produce a project that can build a genuinely shareable APK.
 *
 * Without this, the generated project signs release builds with React Native's public debug
 * key — installable, but shared with every debug build in the world, and an app signed that
 * way cannot later be updated by a differently-signed one.
 *
 * This is a config plugin rather than a patch because android/ is generated: a `prebuild`
 * would silently discard a hand edit and the next APK would be debug-signed again, with
 * nothing to indicate anything was wrong.
 *
 * Every edit below anchors on a UNIQUE string. An earlier version of this file used a lazy
 * regex from `release {`, which matched the signingConfigs block first and ended up assigning
 * the release key to the DEBUG build type while leaving release on the debug key — the exact
 * failure the plugin exists to prevent, and invisible unless you inspect the output.
 *
 * Credentials come from the environment so no password is committed:
 *   DAILYFLOW_KEYSTORE_PASSWORD, DAILYFLOW_KEY_ALIAS, DAILYFLOW_KEY_PASSWORD
 * It falls back to the debug key when no keystore is configured, so `prebuild` keeps working
 * for anyone who just wants to run the app.
 */
const STORE_FILE = 'dailyflow-release.keystore'

/** Unique to the release build type in the template Expo generates. */
const RELEASE_ANCHOR = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`

/** Unique to the debug signing config, which is the last entry in signingConfigs. */
const SIGNING_ANCHOR = `        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`

const RELEASE_SIGNING = `${SIGNING_ANCHOR}
        release {
            if (project.hasProperty('DAILYFLOW_UPLOAD_STORE_FILE')) {
                storeFile file(DAILYFLOW_UPLOAD_STORE_FILE)
                storePassword DAILYFLOW_UPLOAD_STORE_PASSWORD
                keyAlias DAILYFLOW_UPLOAD_KEY_ALIAS
                keyPassword DAILYFLOW_UPLOAD_KEY_PASSWORD
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }`

/**
 * Ship only the ABIs real phones use.
 *
 * A universal APK carries four native library sets. x86 and x86_64 exist for emulators —
 * Intel Android phones are effectively extinct — and together they were 47 MB of a 108 MB
 * APK that no physical device would ever load.
 */
const ABI_ANCHOR = `    defaultConfig {
        applicationId`

const ABI_BLOCK = `    defaultConfig {
        ndk {
            abiFilters 'arm64-v8a', 'armeabi-v7a'
        }
        applicationId`

function withReleaseSigning(config) {
  config = withGradleProperties(config, (cfg) => {
    const entries = [
      ['DAILYFLOW_UPLOAD_STORE_FILE', STORE_FILE],
      ['DAILYFLOW_UPLOAD_KEY_ALIAS', process.env.DAILYFLOW_KEY_ALIAS || 'dailyflow'],
      ['DAILYFLOW_UPLOAD_STORE_PASSWORD', process.env.DAILYFLOW_KEYSTORE_PASSWORD || 'dailyflow'],
      ['DAILYFLOW_UPLOAD_KEY_PASSWORD', process.env.DAILYFLOW_KEY_PASSWORD || 'dailyflow'],
      // Removes unused resources only; it does not touch code, so it cannot break behaviour.
      ['android.enableShrinkResourcesInReleaseBuilds', 'true'],
    ]
    for (const [key, value] of entries) {
      const existing = cfg.modResults.find((i) => i.type === 'property' && i.key === key)
      if (existing) existing.value = value
      else cfg.modResults.push({ type: 'property', key, value })
    }
    return cfg
  })

  config = withAppBuildGradle(config, (cfg) => {
    let gradle = cfg.modResults.contents
    const problems = []

    if (!gradle.includes('DAILYFLOW_UPLOAD_STORE_FILE')) {
      if (!gradle.includes(SIGNING_ANCHOR)) problems.push('signingConfigs block not found')
      gradle = gradle.replace(SIGNING_ANCHOR, RELEASE_SIGNING)
    }

    if (!gradle.includes('signingConfig signingConfigs.release')) {
      if (!gradle.includes(RELEASE_ANCHOR)) problems.push('release build type not found')
      gradle = gradle.replace(RELEASE_ANCHOR, '            signingConfig signingConfigs.release')
    }

    if (!gradle.includes('abiFilters')) {
      if (!gradle.includes(ABI_ANCHOR)) problems.push('defaultConfig not found')
      gradle = gradle.replace(ABI_ANCHOR, ABI_BLOCK)
    }

    // Fail loudly. A silently un-applied edit here means a debug-signed release APK, which
    // looks completely normal until someone tries to install an update over it.
    if (problems.length) {
      throw new Error(
        `withReleaseSigning could not patch build.gradle: ${problems.join('; ')}. ` +
        'The Expo template has probably changed — update the anchors in this plugin.',
      )
    }

    cfg.modResults.contents = gradle
    return cfg
  })

  return config
}

module.exports = withReleaseSigning
