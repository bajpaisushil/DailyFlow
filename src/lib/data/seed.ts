import type { Checklist, ChecklistItem } from '@/lib/types'
import { checklists, newId, settings } from '@/lib/db/repo'

/**
 * First-run content (REQUIREMENTS.md #47 — the app must be useful the moment it opens,
 * with no setup wall).
 *
 * Only *lists* are seeded, never places or day plans: a list is useful immediately and needs
 * no permission, no location and no decisions. Places need real coordinates and day plans need
 * to reflect a real life, so those stay empty and are offered as one-tap starters instead of
 * being invented on the user's behalf.
 *
 * Everything seeded here is ordinary content the user can edit or remove like anything else.
 */

interface SeedItem {
  label: string
  icon: string
  important?: boolean
  optional?: boolean
}

function items(list: SeedItem[]): ChecklistItem[] {
  return list.map((it, i) => ({
    id: newId(),
    label: it.label,
    icon: it.icon,
    important: it.important,
    optional: it.optional,
    order: i,
  }))
}

const STARTER_LISTS: Array<Pick<Checklist, 'name' | 'icon' | 'resetRule'> & { items: ChecklistItem[] }> = [
  {
    name: 'Work bag',
    icon: 'work',
    resetRule: { kind: 'daily' },
    items: items([
      { label: 'Phone', icon: 'phone', important: true },
      { label: 'Keys', icon: 'keys', important: true },
      { label: 'Wallet', icon: 'wallet', important: true },
      { label: 'Laptop', icon: 'laptop' },
      { label: 'Charger', icon: 'charger' },
      { label: 'Water bottle', icon: 'bottle', optional: true },
    ]),
  },
  {
    name: 'Gym bag',
    icon: 'gym',
    resetRule: { kind: 'onRoutineStart' },
    items: items([
      { label: 'Shoes', icon: 'shoes', important: true },
      { label: 'Water bottle', icon: 'bottle', important: true },
      { label: 'Towel', icon: 'towel' },
      { label: 'Earphones', icon: 'earphones', optional: true },
    ]),
  },
  {
    name: 'Going out',
    icon: 'bag',
    resetRule: { kind: 'daily' },
    items: items([
      { label: 'Phone', icon: 'phone', important: true },
      { label: 'Keys', icon: 'keys', important: true },
      { label: 'Wallet', icon: 'wallet', important: true },
      { label: 'Umbrella', icon: 'umbrella', optional: true },
    ]),
  },
]

/** Runs once, the first time the app is opened. Safe to call on every launch. */
export function seedIfFirstRun(): boolean {
  const current = settings.read()
  if (current.onboardingCompletedAt != null) return false
  if (checklists.count() > 0) return false

  const now = Date.now()
  checklists.saveMany(
    STARTER_LISTS.map((l) => ({
      id: newId(),
      name: l.name,
      icon: l.icon,
      items: l.items,
      resetRule: l.resetRule,
      createdAt: now,
      updatedAt: now,
    })),
  )
  return true
}

/** Marks first run as finished. Called once the user has seen Today. */
export function markOnboarded(): void {
  const current = settings.read()
  if (current.onboardingCompletedAt != null) return
  settings.write({ ...current, onboardingCompletedAt: Date.now() })
}
