import { create } from 'zustand'
import type { Automation, Checklist, ChecklistRun, CommuteSession, Place, Routine } from '@/lib/types'
import * as repo from '@/lib/db/repo'
import { localDateKey } from '@/lib/time'
import { syncGeofences } from '@/lib/location/geofence'

/**
 * The in-memory mirror of the on-device database.
 *
 * Reads are synchronous at startup (SQLite opens sync), so this store is fully populated
 * on the very first render — no spinners, no empty first frame. Writes go through the
 * repository and then refresh the affected slice, which keeps SQLite the single source of
 * truth while React reads from cheap memory.
 */

interface DataState {
  places: Place[]
  checklists: Checklist[]
  routines: Routine[]
  automations: Automation[]
  runs: ChecklistRun[]
  activeCommute: CommuteSession | null

  refresh: () => void

  savePlace: (p: Place) => void
  removePlace: (id: string) => void
  saveChecklist: (c: Checklist) => void
  removeChecklist: (id: string) => void
  saveRoutine: (r: Routine) => void
  removeRoutine: (id: string) => void
  saveAutomation: (a: Automation) => void
  removeAutomation: (id: string) => void

  /** Tick or untick one thing on a list, creating today's run lazily. */
  toggleItem: (checklistId: string, itemId: string) => void
  /** Clear every tick for today. */
  clearRun: (checklistId: string) => void
}

function readAll() {
  return {
    places: repo.places.all(),
    checklists: repo.checklists.all(),
    routines: repo.routines.all(),
    automations: repo.automations.all(),
    runs: repo.checklistRuns.all(),
    activeCommute: repo.commuteSessions.active(),
  }
}

export const useData = create<DataState>((set, get) => ({
  ...readAll(),

  refresh: () => set(readAll()),

  savePlace: (p) => {
    repo.places.save(p)
    set({ places: repo.places.all() })
    // The OS holds the region list, so it must be refreshed whenever places change.
    void syncGeofences()
  },
  removePlace: (id) => {
    repo.places.remove(id)
    set({ places: repo.places.all() })
    void syncGeofences()
  },

  saveChecklist: (c) => {
    repo.checklists.save(c)
    set({ checklists: repo.checklists.all() })
  },
  removeChecklist: (id) => {
    repo.checklists.remove(id)
    set({ checklists: repo.checklists.all() })
  },

  saveRoutine: (r) => {
    repo.routines.save(r)
    set({ routines: repo.routines.all() })
  },
  removeRoutine: (id) => {
    repo.routines.remove(id)
    set({ routines: repo.routines.all() })
  },

  saveAutomation: (a) => {
    repo.automations.save(a)
    set({ automations: repo.automations.all() })
  },
  removeAutomation: (id) => {
    repo.automations.remove(id)
    set({ automations: repo.automations.all() })
  },

  toggleItem: (checklistId, itemId) => {
    const periodKey = localDateKey(new Date())
    const existing = repo.checklistRuns.forPeriod(checklistId, periodKey)
    const checklist = get().checklists.find((c) => c.id === checklistId)

    const run: ChecklistRun = existing ?? {
      id: repo.newId(),
      checklistId,
      periodKey,
      checkedItemIds: [],
      startedAt: Date.now(),
    }

    const checked = new Set(run.checkedItemIds)
    if (checked.has(itemId)) checked.delete(itemId)
    else checked.add(itemId)

    const required = checklist?.items.filter((i) => !i.optional) ?? []
    const allDone = required.length > 0 && required.every((i) => checked.has(i.id))

    repo.checklistRuns.save({
      ...run,
      checkedItemIds: [...checked],
      completedAt: allDone ? (run.completedAt ?? Date.now()) : undefined,
    })
    set({ runs: repo.checklistRuns.all() })
  },

  clearRun: (checklistId) => {
    const periodKey = localDateKey(new Date())
    const existing = repo.checklistRuns.forPeriod(checklistId, periodKey)
    if (!existing) return
    repo.checklistRuns.save({ ...existing, checkedItemIds: [], completedAt: undefined })
    set({ runs: repo.checklistRuns.all() })
  },
}))
