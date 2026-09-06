import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import type { Automation, Place } from '@/lib/types'
import * as repo from '@/lib/db/repo'
import { supportsBackgroundGeofencing } from '@/lib/runtime'
import { decide, record } from '@/lib/engine/governance'
import { notifyNow } from '@/lib/notify/scheduler'
import { localDateKey } from '@/lib/time'
import { approachRadiusMetres } from './approach'

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
    const placeId = data.region.identifier

    try {
      await handleRegionEvent(placeId, entering)
    } catch {
      // A failure here must never crash the background task; the miss is simply not recorded.
    }
  })
}

/**
 * Runs in the background, possibly with no UI alive. It reads straight from SQLite rather
 * than any React store, because no store exists in this context.
 */
async function handleRegionEvent(placeId: string, entering: boolean): Promise<void> {
  const place = repo.places.get(placeId)
  if (!place) return

  repo.activity.add({
    kind: entering ? 'place.entered' : 'place.exited',
    summary: entering ? `You got to ${place.name}` : `You left ${place.name}`,
    placeId,
  })

  const wanted = entering ? 'place.enter' : 'place.exit'
  const matching = repo.automations
    .all()
    .filter((a) => a.enabled && a.trigger.kind === wanted && a.trigger.params.placeId === placeId)

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
    })

    record(automation, occurrenceKey, decision, notify.params.title)

    if (decision.allow) {
      await notifyNow({
        title: notify.params.title,
        body: notify.params.body,
        priority: notify.params.priority,
      })
    }
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
export function regionsToWatch(places: Place[], automations: Automation[]): Location.LocationRegion[] {
  const referenced = new Set(
    automations
      .filter((a) => a.enabled && (a.trigger.kind === 'place.enter' || a.trigger.kind === 'place.exit'))
      .map((a) => (a.trigger as { params: { placeId: string } }).params.placeId),
  )

  /**
   * The largest circle any reminder asks for around each place.
   *
   * "Wake me six minutes before my stop" is a four-kilometre circle, not a hundred-metre one,
   * so the region handed to the OS has to be the widest one requested — otherwise the control
   * exists in the UI and does nothing in reality.
   */
  const approachByPlace = new Map<string, number>()
  for (const reminder of repo.reminders.all()) {
    if (!reminder.enabled) continue
    for (const trigger of reminder.placeTriggers) {
      if (trigger.on !== 'arrive' || !trigger.approachMinutes) continue
      const place = places.find((p) => p.id === trigger.placeId)
      if (!place) continue
      const radius = approachRadiusMetres(trigger, place.radiusM)
      approachByPlace.set(place.id, Math.max(approachByPlace.get(place.id) ?? 0, radius))
    }
  }

  const ranked = [...places].sort((a, b) => {
    const score = (p: Place) => (referenced.has(p.id) ? 2 : p.pinned ? 1 : 0)
    return score(b) - score(a)
  })

  return ranked.slice(0, MAX_REGIONS).map((p) => ({
    identifier: p.id,
    latitude: p.lat,
    longitude: p.lon,
    // A small inflation absorbs ordinary GPS error, so arriving is detected reliably without
    // making the region so loose that it fires from the next street. An approach request
    // overrides it entirely — that circle is meant to be large.
    radius: Math.max(80, approachByPlace.get(p.id) ?? p.radiusM),
    notifyOnEnter: true,
    notifyOnExit: true,
  }))
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
