import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { Automation, Place, Reminder } from '@/lib/types'
import * as repo from '@/lib/db/repo'
import { supportsBackgroundGeofencing } from '@/lib/runtime'
import { decide, record } from '@/lib/engine/governance'
import { notifyNow } from '@/lib/notify/scheduler'
import { alarmModuleAvailable, ringAlarm } from '@/lib/notify/alarm'
import { localDateKey } from '@/lib/time'
import { approachRadiusMetres } from './approach'
import { parseRegionId, radiiForPlace, radiusForTrigger, regionId } from './regions'

export { parseRegionId, radiiForPlace, regionId } from './regions'

/**
 * Background geofencing.
 *
 * The OS watches the regions using hardware-assisted, low-power monitoring and wakes the app
 * when one is crossed — even from a terminated state. This is the second capability the web
 * simply could not provide: the W3C Geolocation spec forbids position updates to a
 * non-visible document, so browser "geofencing" cannot exist at all.
 *
 * Battery discipline (REQUIREMENTS.md #37): we never run a polling loop and never hold the
 * GPS chip open. We hand the OS a list of regions and go back to sleep.
 */

export const GEOFENCE_TASK = 'dailyflow.geofence'

/**
 * iOS monitors at most 20 regions per app, so the set is prioritised rather than truncated
 * arbitrarily: places referenced by an enabled rule come first, then pinned places.
 */
const MAX_REGIONS = 18

/**
 * Defined at module scope so it is registered during the cold start the OS performs when it
 * delivers a region event. Registering inside a component would be too late.
 */
if (supportsBackgroundGeofencing) {
  TaskManager.defineTask<{
    eventType: Location.GeofencingEventType
    region: Location.LocationRegion
  }>(GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data?.region?.identifier) return

    const entering = data.eventType === Location.GeofencingEventType.Enter

    try {
      await handleRegionEvent(data.region.identifier, entering)
    } catch {
      // A failure here must never crash the background task; the miss is simply not recorded.
    }
  })
}

/**
 * Runs in the background, possibly with no UI alive. It reads straight from SQLite rather
 * than any React store, because no store exists in this context.
 */
async function handleRegionEvent(identifier: string, entering: boolean): Promise<void> {
  const { placeId, radiusM } = parseRegionId(identifier)
  const place = repo.places.get(placeId)
  if (!place) return

  repo.activity.add({
    kind: entering ? 'place.entered' : 'place.exited',
    summary: entering ? `You got to ${place.name}` : `You left ${place.name}`,
    placeId,
  })

  const wanted = entering ? 'place.enter' : 'place.exit'
  const reminders = repo.reminders.all()

  /**
   * Only the reminders that asked for THIS circle.
   *
   * Without this, crossing the widest circle fired every reminder on the place — so an
   * "when I arrive" reminder went off kilometres away because some other reminder wanted an
   * early warning.
   */
  const matchesRadius = (automation: Automation): boolean => {
    if (radiusM == null) return true
    const reminder = reminders.find((r) => r.id === automation.sourceReminderId)
    if (!reminder) return true

    const trigger = reminder.placeTriggers.find(
      (t) => t.placeId === placeId && t.on === (entering ? 'arrive' : 'leave'),
    )
    if (!trigger) return true

    return Math.round(radiusForTrigger(place, trigger)) === radiusM
  }

  const matching = repo.automations
    .all()
    .filter((a) => a.enabled && a.trigger.kind === wanted && a.trigger.params.placeId === placeId)
    .filter(matchesRadius)

  if (matching.length === 0) return

  const now = new Date()
  const settings = repo.settings.read()
  const checklists = repo.checklists.all()
  const runs = repo.checklistRuns.all()
  const today = now.getDay()

  for (const automation of matching) {
    // Day conditions are evaluated here because the OS knows nothing about them.
    if (!passesDayConditions(automation, today)) continue

    // One firing per place-crossing per day keeps a boundary-hovering user from being spammed.
    const occurrenceKey = `${localDateKey(now)}:${entering ? 'in' : 'out'}`

    const notify = automation.actions.find((a) => a.kind === 'notify')
    if (!notify || notify.kind !== 'notify') continue

    const decision = decide({
      automation,
      occurrenceKey,
      priority: notify.params.priority,
      now,
      settings,
      checklists,
      runs,
      // So "you already ticked everything" means THIS occurrence's ticks, not this morning's.
      reminders: repo.reminders.all(),
    })

    if (!decision.allow) {
      record(automation, occurrenceKey, decision, notify.params.title)
      continue
    }

    /**
     * A place-triggered ALARM rings for real rather than arriving as a notification.
     *
     * This is the case the whole feature exists for — "wake me six minutes before my stop" —
     * and a banner does not wake anyone. When the module is unavailable (Expo Go, iOS) it
     * falls through to the notification, which is the loudest thing available there.
     */
    if (notify.params.alertStyle === 'alarm' && alarmModuleAvailable()) {
      const rang = ringAlarm({
        title: notify.params.title,
        body: notify.params.body,
        soundFile: notify.params.toneId,
        durationSeconds: notify.params.alarmDurationSeconds,
      })
      if (rang) {
        record(automation, occurrenceKey, decision, notify.params.title)
        continue
      }
    }

    const delivered = await notifyNow({
      title: notify.params.title,
      body: notify.params.body,
      priority: notify.params.priority,
      // Was dropped here, so "wake me before my stop" — the one case the alarm channel
      // exists for — arrived as an ordinary notification at normal importance.
      alertStyle: notify.params.alertStyle,
      toneId: notify.params.toneId,
    })

    /**
     * The ledger is written AFTER the attempt, and records what actually happened.
     *
     * It used to be written first, marking the firing 'fired' before delivery was tried. If
     * the notification then failed — permission revoked, the module unavailable — the ledger
     * said it had been delivered, so the dedup key blocked every future attempt and the user
     * never got that reminder again. A silent, permanent loss.
     */
    record(
      automation,
      occurrenceKey,
      delivered ? decision : { allow: false, reason: 'Your phone would not show it.' },
      notify.params.title,
    )
  }
}

function passesDayConditions(automation: Automation, weekday: number): boolean {
  for (const condition of automation.conditions) {
    if (condition.kind !== 'day.isOneOf') continue
    const listed = condition.params.days.includes(weekday as never)
    if (condition.negate ? listed : !listed) return false
  }
  return true
}

/** Places worth monitoring, most useful first, capped to the platform limit. */
/**
 * The regions to hand to the OS.
 *
 * ONE REGION PER DISTINCT RADIUS, not one per place. A single circle sized by the widest
 * request meant that if one reminder asked to be woken six minutes before the office (a
 * 4.5 km circle) and another simply said "when I arrive at the office", BOTH fired at
 * 4.5 km — so the arrival reminder went off while the user was still three stops away.
 * Each request now gets its own circle, and `handleRegionEvent` only fires the reminders
 * that asked for the circle that was actually crossed.
 */
export function regionsToWatch(places: Place[], automations: Automation[]): Location.LocationRegion[] {
  const referenced = new Set(
    automations
      .filter((a) => a.enabled && (a.trigger.kind === 'place.enter' || a.trigger.kind === 'place.exit'))
      .map((a) => (a.trigger as { params: { placeId: string } }).params.placeId),
  )

  const reminders = repo.reminders.all()

  const ranked = [...places].sort((a, b) => {
    const score = (p: Place) => (referenced.has(p.id) ? 2 : p.pinned ? 1 : 0)
    return score(b) - score(a)
  })

  const regions: Location.LocationRegion[] = []
  for (const place of ranked) {
    for (const radius of radiiForPlace(place, reminders)) {
      // The platform cap is a hard limit, so stop rather than let the OS silently drop the
      // tail of the list.
      if (regions.length >= MAX_REGIONS) return regions
      regions.push({
        identifier: regionId(place.id, radius),
        latitude: place.lat,
        longitude: place.lon,
        radius,
        notifyOnEnter: true,
        notifyOnExit: true,
      })
    }
  }
  return regions
}

export interface GeofenceStatus {
  running: boolean
  watched: number
  reason?: 'noPermission' | 'noPlaces' | 'unsupported'
}

/**
 * Start or refresh monitoring. Safe to call after any change to places or rules.
 * Returns honestly when it could not start, so the UI can say so instead of implying it works.
 */
export async function syncGeofences(): Promise<GeofenceStatus> {
  // Expo Go cannot register background tasks. Report that honestly rather than appearing
  // to start monitoring and then never firing.
  if (!supportsBackgroundGeofencing) {
    return { running: false, watched: 0, reason: 'unsupported' }
  }

  const places = repo.places.all()
  const automations = repo.automations.all()
  const regions = regionsToWatch(places, automations)

  const already = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK).catch(() => false)

  if (regions.length === 0) {
    if (already) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined)
    return { running: false, watched: 0, reason: 'noPlaces' }
  }

  const background = await Location.getBackgroundPermissionsAsync().catch(() => null)
  if (background?.status !== 'granted') {
    return { running: false, watched: 0, reason: 'noPermission' }
  }

  try {
    if (already) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined)
    await Location.startGeofencingAsync(GEOFENCE_TASK, regions)
    return { running: true, watched: regions.length }
  } catch {
    return { running: false, watched: 0, reason: 'unsupported' }
  }
}

export async function stopGeofences(): Promise<void> {
  const registered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK).catch(() => false)
  if (registered) await Location.stopGeofencingAsync(GEOFENCE_TASK).catch(() => undefined)
}
