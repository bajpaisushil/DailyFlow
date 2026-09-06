import type { Reminder } from '@/lib/types'
import { describeDays, formatTime } from '@/lib/time'

/**
 * A reminder, said back as a plain sentence.
 *
 * Every row in the list explains itself, so nothing has to be opened to find out what it
 * does — which matters most for exactly the people who find opening and reading a settings
 * screen hardest.
 */
export function describeReminder(
  reminder: Reminder,
  opts: { placeNames: Map<string, string>; use24h: boolean; locale: string },
): string {
  const parts: string[] = []

  if (reminder.times.length > 0) {
    const when = reminder.times.map((t) => formatTime(t, opts.use24h, opts.locale)).join(', ')
    const days = describeDays(reminder.days, opts.locale).toLowerCase()
    const early = reminder.leadMinutes.filter((m) => m > 0).sort((a, b) => b - a)

    if (early.length > 0) {
      const leadText = early.map((m) => `${m} min`).join(' and ')
      parts.push(`${leadText} before ${when}, ${days}`)
    } else {
      parts.push(`At ${when}, ${days}`)
    }
  }

  for (const trigger of reminder.placeTriggers) {
    const name = opts.placeNames.get(trigger.placeId) ?? 'a place'
    parts.push(trigger.on === 'arrive' ? `When you reach ${name}` : `When you leave ${name}`)
  }

  if (parts.length === 0) return 'Not set up yet'
  return parts.join(' · ')
}
