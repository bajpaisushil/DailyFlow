import type { Reminder } from '@/lib/types'
import { localDateKey, minutesOfDay, parseHHMM, weekdayOf } from '@/lib/time'

/**
 * Which run of a checklist we are currently in.
 *
 * A "take with you" list was keyed by DATE alone, so ticking everything off before the 08:00
 * school run left the list still ticked for the 18:00 one — the user saw yesterday's answer to
 * today's question and had no way to ask again except waiting for midnight. Keying by the
 * OCCURRENCE instead means each firing of the reminder gets its own fresh list.
 *
 * A checklist attached to nothing, or to a reminder that happens once a day, keeps the plain
 * date key: adding an occurrence marker there would only orphan the runs already stored.
 */
export function checklistPeriodKey(checklistId: string, reminders: Reminder[], now: Date): string {
  const date = localDateKey(now)
  const slot = currentSlot(checklistId, reminders, now)
  return slot ? `${date}#${slot}` : date
}

/**
 * The most recent time today that this checklist's reminders were due, or the first upcoming
 * one before any has passed.
 *
 * Returns null when the answer would be the same all day, which is the common case and the
 * one that must keep its existing key.
 */
function currentSlot(checklistId: string, reminders: Reminder[], now: Date): string | null {
  const today = weekdayOf(now)

  const times = new Set<string>()
  for (const r of reminders) {
    if (r.checklistId !== checklistId) continue
    if (!r.enabled) continue
    // A reminder that does not run today has no say in when today's list resets.
    if (r.days.length > 0 && !r.days.includes(today)) continue
    for (const t of r.times) if (parseHHMM(t) != null) times.add(t)
  }

  // Nothing to split the day by: one occurrence, or none at all.
  if (times.size < 2) return null

  const sorted = [...times].sort()
  const minutes = minutesOfDay(now)

  /**
   * Before the first occurrence the list belongs to that first one — not to yesterday's last.
   * Someone packing their bag at 06:00 for an 08:00 departure is filling in the 08:00 list.
   */
  let slot = sorted[0]!
  for (const t of sorted) {
    const at = parseHHMM(t)
    if (at != null && at <= minutes) slot = t
  }
  return slot
}
