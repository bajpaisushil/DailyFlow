import type { Place } from '@/lib/types'

/**
 * Working out how fast someone travels, so they never have to say.
 *
 * "Wake me six minutes before my stop" needs a distance, and a distance needs a speed. Asking
 * "are you walking, on a bus, or on a metro?" is precisely the kind of question this app
 * should answer for itself — the phone already knows how fast it is moving.
 *
 * Two sources, in order of trust:
 *  1. What the GPS reports right now, if the user is actually moving.
 *  2. What was observed on previous trips to that place, kept as a rolling average.
 *
 * The fallback is deliberately middling rather than optimistic. Guessing too FAST makes the
 * circle too big and the warning too early, which is merely annoying. Guessing too SLOW makes
 * it too small and the warning too late, which means missing the stop — so when in doubt the
 * estimate errs high.
 */

/** Urban blend of bus, car and metro. Used until anything better is known. */
export const DEFAULT_SPEED_KMH = 32

/** Below this the reading is noise, or someone standing still on a platform. */
const MOVING_THRESHOLD_KMH = 2

/** Above this the reading is almost certainly a GPS glitch. */
const IMPLAUSIBLE_KMH = 200

/** Weight given to a new observation. Low, so one bad sample cannot swing the estimate. */
const SMOOTHING = 0.3

export interface SpeedSample {
  /** Metres per second, as the platform reports it. */
  metresPerSecond: number | null | undefined
}

/** A usable km/h reading, or null when the sample says nothing useful. */
export function toKmh(sample: SpeedSample): number | null {
  const mps = sample.metresPerSecond
  if (typeof mps !== 'number' || !Number.isFinite(mps) || mps < 0) return null
  const kmh = mps * 3.6
  if (kmh < MOVING_THRESHOLD_KMH || kmh > IMPLAUSIBLE_KMH) return null
  return kmh
}

/**
 * The speed to use for a place's approach circle.
 * `current` wins when the user is genuinely moving, because it describes this trip rather
 * than an average of past ones.
 */
export function estimateSpeedKmh(place: Pick<Place, 'observedSpeedKmh'>, current?: number | null): number {
  if (current != null && current >= MOVING_THRESHOLD_KMH && current <= IMPLAUSIBLE_KMH) {
    return current
  }
  return place.observedSpeedKmh ?? DEFAULT_SPEED_KMH
}

/**
 * Fold a new observation into a place's rolling average, so the estimate improves with use.
 * Returns the value to store, or null when the sample was not worth keeping.
 */
export function learnSpeed(place: Pick<Place, 'observedSpeedKmh'>, observedKmh: number | null): number | null {
  if (observedKmh == null) return null
  const previous = place.observedSpeedKmh
  if (previous == null) return Math.round(observedKmh)
  return Math.round(previous * (1 - SMOOTHING) + observedKmh * SMOOTHING)
}

/** Plain words for a speed, only ever shown as reassurance — never as a thing to choose. */
export function describeSpeed(kmh: number): string {
  if (kmh < 7) return 'walking pace'
  if (kmh < 20) return 'cycling pace'
  if (kmh < 40) return 'road speed'
  return 'train speed'
}
