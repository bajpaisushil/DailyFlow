const { withEntitlementsPlist } = require('expo/config-plugins')

/**
 * Removes the push-notification entitlement from the iOS build.
 *
 * expo-notifications writes `aps-environment` unconditionally, because it assumes an app that
 * schedules notifications might also receive them from a server. DailyFlow never will — it has
 * no backend by design, and every notification it shows is scheduled locally on the device.
 *
 * Leaving it in has a real cost: a free Apple ID (a Personal Team) cannot sign an app that
 * declares push, so its presence alone would force a $99/year Apple Developer membership on
 * someone who only wants to run this on their own phone. Stripping it means a local build with
 * a free account works.
 *
 * If DailyFlow ever gains server push, delete this plugin — do not add the entitlement back
 * by hand, so the two decisions cannot drift apart.
 */
function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment']
    return cfg
  })
}

module.exports = withNoPushEntitlement
