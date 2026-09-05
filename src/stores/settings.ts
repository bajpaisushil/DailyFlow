import { create } from 'zustand'
import type { AppSettings } from '@/lib/types'
import { settings as settingsRepo } from '@/lib/db/repo'

/**
 * Settings are read synchronously at module load. `expo-sqlite` opens and queries
 * synchronously on native, so the very first render already has the correct theme,
 * locale and clock format — no loading flash, no hydration gap (REQUIREMENTS.md #48).
 */

interface SettingsState {
  settings: AppSettings
  /** Shallow patch; nested groups are merged one level deep for convenience. */
  update: (patch: Partial<AppSettings>) => void
  updateNotifications: (patch: Partial<AppSettings['notifications']>) => void
  updateLocation: (patch: Partial<AppSettings['location']>) => void
  reload: () => void
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: settingsRepo.read(),

  update: (patch) => {
    const next = settingsRepo.write({ ...get().settings, ...patch })
    set({ settings: next })
  },

  updateNotifications: (patch) => {
    const current = get().settings
    const next = settingsRepo.write({
      ...current,
      notifications: { ...current.notifications, ...patch },
    })
    set({ settings: next })
  },

  updateLocation: (patch) => {
    const current = get().settings
    const next = settingsRepo.write({
      ...current,
      location: { ...current.location, ...patch },
    })
    set({ settings: next })
  },

  reload: () => set({ settings: settingsRepo.read() }),
}))

/** Non-reactive read, for engine code running outside React. */
export function readSettings(): AppSettings {
  return useSettings.getState().settings
}
