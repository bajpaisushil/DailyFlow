import React, { createContext, useContext, useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { palettes, type Palette, type Scheme } from './tokens'
import type { ThemePreference } from '@/lib/types'
import { useSettings } from '@/stores/settings'

interface ThemeValue {
  scheme: Scheme
  colors: Palette
  preference: ThemePreference
  setPreference: (p: ThemePreference) => void
}

const ThemeContext = createContext<ThemeValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const preference = useSettings((s) => s.settings.theme)
  const update = useSettings((s) => s.update)
  const system = useColorScheme()

  const scheme: Scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      colors: palettes[scheme],
      preference,
      setPreference: (p) => update({ theme: p }),
    }),
    [scheme, preference, update],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}

export function useColors(): Palette {
  return useTheme().colors
}
