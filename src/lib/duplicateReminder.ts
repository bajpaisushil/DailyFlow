import type { Reminder } from '@/lib/types'

/**
 * Copy a reminder so the same thing can be set up again at a different time.
 *
 * The common case is a reminder that is nearly right: the same medicine at a second time of
 * day, the same "take your bag" for a different day of the week. Rebuilding it by hand — the
 * icon, the place, the sound, the lead times — is a lot of taps to arrive somewhere the user
 * had already been.
 *
 * Pure, so the parts that are easy to get wrong can be tested: every id must be NEW. A copy
 * that shares its place-trigger ids with the original is not a copy, it is two references to
 * one thing, and editing either would silently change both.
 */
export function duplicateReminder(
  source: Reminder,
  ids: {
    /** The new reminder's id. */
    reminder: string
    /** A fresh id per place trigger, in order. Must be at least as long as the source's. */
    placeTriggers: string[]
  },
  now = Date.now(),
): Reminder {
  return {
    ...source,
    id: ids.reminder,
    title: copyTitle(source.title),

    /**
     * Fresh ids, never the source's. Arrays are rebuilt rather than spread, so the copy shares
     * no object with the original — mutating one must never reach the other.
     */
    placeTriggers: source.placeTriggers.map((trigger, i) => ({
      ...trigger,
      id: ids.placeTriggers[i] ?? `${ids.reminder}-p${i}`,
    })),
    times: [...source.times],
    days: [...source.days],
    leadMinutes: [...source.leadMinutes],

    /**
     * The checklist is deliberately SHARED, not copied. A list is a thing the user maintains
     * in one place; duplicating "take your bag" should not silently fork the list of what goes
     * in the bag into two that drift apart.
     */
    checklistId: source.checklistId,

    createdAt: now,
    updatedAt: now,
    // A copy is never a tombstone, whatever state the original was in.
    deletedAt: undefined,
  }
}

/**
 * "Morning pills" becomes "Morning pills (copy)", and copying that again gives "(copy 2)"
 * rather than "(copy) (copy)".
 */
export function copyTitle(title: string): string {
  const trimmed = title.trim()
  const match = /^(.*)\((?:copy)(?:\s+(\d+))?\)$/i.exec(trimmed)
  if (match) {
    const base = (match[1] ?? '').trimEnd()
    const n = match[2] ? Number(match[2]) : 1
    return `${base} (copy ${n + 1})`
  }
  return trimmed.length > 0 ? `${trimmed} (copy)` : 'Reminder (copy)'
}
