/**
 * How long an alarm rings — the pure part.
 *
 * Separate from `alarm.ts` because that module reaches the native alarm, which drags in the
 * whole Expo runtime and cannot be loaded by the Node test runner. The arithmetic and the
 * words are exactly what most needs testing, so they live somewhere testable.
 */

/** Default ring length. Long enough to wake someone, short enough not to flatten a battery. */
export const DEFAULT_ALARM_SECONDS = 60

/**
 * "Keep ringing until I stop it", stored as zero.
 *
 * Zero rather than a large number so the INTENT survives: the app can say "until you stop it"
 * back to the user instead of "30 minutes", and the real ceiling can change without rewriting
 * what everyone already saved.
 *
 * Zero is also the trap. Every other part of the system reads this as a duration, and `||`
 * anywhere in that chain would silently turn "keep going" into the 60-second default — an
 * alarm that gives up after a minute when the user asked for the opposite.
 */
export const RING_UNTIL_STOPPED = 0

/**
 * What "until I stop it" really lasts.
 *
 * An endless alarm is not something to arm: a phone in a bag with nobody to hear it would ring
 * itself flat, and a lost battery is how an alarm app gets uninstalled. Half an hour is long
 * past the point where an alarm is still doing its job. The UI says this out loud rather than
 * implying it is infinite.
 */
export const RING_UNTIL_STOPPED_SECONDS = 30 * 60

/** Ring length in words. Never a bare number of seconds. */
export function describeRingLength(seconds: number): string {
  if (seconds <= RING_UNTIL_STOPPED) return 'Until I stop it'
  if (seconds < 60) return `${seconds} seconds`
  const minutes = seconds / 60
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}
