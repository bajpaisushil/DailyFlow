import type {
  ActivityEvent, AppSettings, Automation, Checklist, ChecklistRun, CommuteProfile,
  CommuteSession, FiringRecord, Place, Routine,
} from '@/lib/types'
import * as store from './sqlite'

/**
 * Typed access to each collection. Thin on purpose — the document store underneath already
 * gives us indexed single-row reads and ordered scans, so this layer only adds types,
 * timestamps and the soft-delete convention.
 */

export function newId(): string {
  // Available on Hermes via Expo's polyfill; stable and collision-free for our volumes.
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  )
}

function stamp<T extends { createdAt?: number; updatedAt?: number }>(doc: T): T {
  const now = Date.now()
  return { ...doc, createdAt: doc.createdAt ?? now, updatedAt: now }
}

function makeRepo<T extends { id: string; createdAt: number; updatedAt: number; deletedAt?: number }>(
  collection: store.Collection,
) {
  return {
    all: (): T[] => store.all<T>(collection),
    get: (id: string): T | null => store.get<T>(collection, id),
    save: (doc: T): T => {
      const next = stamp(doc)
      store.put(collection, next)
      return next
    },
    saveMany: (docs: T[]): void => store.putMany(collection, docs.map(stamp)),
    remove: (id: string): void => store.softDelete(collection, id),
    purge: (id: string): void => store.hardDelete(collection, id),
    count: (): number => store.count(collection),
  }
}

export const places = makeRepo<Place>('places')
export const checklists = makeRepo<Checklist>('checklists')
export const routines = makeRepo<Routine>('routines')
export const automations = makeRepo<Automation>('automations')
export const commuteProfiles = makeRepo<CommuteProfile>('commuteProfiles')

// ── Collections that are not soft-deleted (they are disposable by nature) ─────

export const checklistRuns = {
  all: (): ChecklistRun[] => store.all<ChecklistRun>('checklistRuns'),
  forPeriod: (checklistId: string, periodKey: string): ChecklistRun | null => {
    const rows = store.all<ChecklistRun>('checklistRuns')
    return rows.find((r) => r.checklistId === checklistId && r.periodKey === periodKey) ?? null
  },
  save: (run: ChecklistRun): ChecklistRun => {
    store.put('checklistRuns', run)
    return run
  },
  /** Runs are disposable; keep only recent periods so the table cannot grow without bound. */
  prune: (keepDays = 30): void => {
    store.pruneOlderThan('checklistRuns', Date.now() - keepDays * 86_400_000)
  },
}

export const commuteSessions = {
  all: (): CommuteSession[] => store.all<CommuteSession>('commuteSessions', { desc: true }),
  active: (): CommuteSession | null => {
    const rows = store.all<CommuteSession>('commuteSessions', { desc: true, limit: 5 })
    return rows.find((s) => s.endedAt == null) ?? null
  },
  save: (s: CommuteSession): CommuteSession => {
    store.put('commuteSessions', s)
    return s
  },
}

export const activity = {
  recent: (limit = 50): ActivityEvent[] => store.all<ActivityEvent>('activity', { desc: true, limit }),
  add: (event: Omit<ActivityEvent, 'id' | 'at'> & { at?: number }): ActivityEvent => {
    const full: ActivityEvent = { id: newId(), at: event.at ?? Date.now(), ...event }
    store.put('activity', full)
    return full
  },
  clear: (): void => store.clearCollection('activity'),
  /** Capped by both age and count so the log can never become a privacy or space problem. */
  prune: (maxEvents: number, maxAgeDays: number): void => {
    store.pruneOlderThan('activity', Date.now() - maxAgeDays * 86_400_000)
    store.pruneToMostRecent('activity', maxEvents)
  },
}

export const firings = {
  get: (key: string): FiringRecord | null => store.get<FiringRecord>('firings', key),
  has: (key: string): boolean => store.get<FiringRecord>('firings', key) != null,
  record: (rec: FiringRecord): void => store.put('firings', { ...rec, id: rec.key } as never),
  forAutomation: (automationId: string): FiringRecord[] =>
    store.all<FiringRecord>('firings', { desc: true }).filter((f) => f.automationId === automationId),
  /** The ledger only needs enough history to stop duplicates; a fortnight is ample. */
  prune: (keepDays = 14): void => {
    store.pruneOlderThan('firings', Date.now() - keepDays * 86_400_000)
  },
}

// ── Settings: a singleton row, read synchronously at startup ─────────────────

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'singleton',
  schemaVersion: 1,
  theme: 'system',
  experience: 'simple',
  locale: 'en',
  weekStartsOn: 1,
  use24HourClock: false,
  notifications: {
    enabled: false,
    quietHours: { enabled: true, from: '22:00', to: '07:00', allowImportant: false },
    maxPerHour: 3,
    maxPerDay: 8,
    vibrate: true,
    snoozeMinutes: 15,
    suppressWhenChecklistDone: true,
  },
  location: { enabled: false, mode: 'off', accuracy: 'balanced' },
  todaySections: ['next', 'checklist', 'timeline'],
  activeModes: [],
  historyMaxEvents: 300,
  historyMaxAgeDays: 30,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

export const settings = {
  read: (): AppSettings => {
    const found = store.get<AppSettings>('settings', 'singleton')
    if (found) return { ...DEFAULT_SETTINGS, ...found }
    store.put('settings', DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  },
  write: (next: AppSettings): AppSettings => {
    const stamped = { ...next, updatedAt: Date.now() }
    store.put('settings', stamped)
    return stamped
  },
}

export { store }
