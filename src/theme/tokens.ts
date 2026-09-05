import { Platform } from 'react-native'

/**
 * DailyFlow design tokens.
 *
 * Compiled values, not a runtime styling engine: every style in this app goes through
 * `StyleSheet.create`, so it is registered once and costs nothing per render
 * (REQUIREMENTS.md #48 — prefer core primitives wherever a library would cost frames).
 *
 * Visual direction: dimensional and modern — layered surfaces, soft large-radius shadows,
 * gradient accents, glass — while the *interaction* model stays flat and obvious, because
 * the app must be usable by people with low literacy (#17).
 */

export type Scheme = 'light' | 'dark'

export interface Palette {
  /** Page background, furthest back. */
  canvas: string
  /** A slightly deeper canvas used for inset wells. */
  canvasDeep: string
  /** Raised card surface. */
  surface: string
  /** Secondary surface, one step further forward. */
  surfaceAlt: string
  /** Translucent fill used behind blur. */
  glass: string
  line: string
  lineStrong: string
  ink: string
  inkMuted: string
  inkFaint: string
  accent: string
  accentFrom: string
  accentTo: string
  accentSoft: string
  onAccent: string
  good: string
  goodSoft: string
  warn: string
  warnSoft: string
  bad: string
  badSoft: string
  /** Gradient stops for the hero/"now" surface. */
  heroFrom: string
  heroTo: string
  shadowColor: string
}

const light: Palette = {
  canvas: '#F4F5F9',
  canvasDeep: '#E9EAF2',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FC',
  glass: 'rgba(255,255,255,0.72)',
  line: '#E4E6EF',
  lineStrong: '#D2D5E3',
  ink: '#14151F',
  inkMuted: '#61637A',
  inkFaint: '#9598AC',
  accent: '#5B5BD6',
  accentFrom: '#6D6DF0',
  accentTo: '#8B5CF6',
  accentSoft: '#EEEEFC',
  onAccent: '#FFFFFF',
  good: '#16A34A',
  goodSoft: '#E8F7EE',
  warn: '#D97706',
  warnSoft: '#FEF3E2',
  bad: '#DC2626',
  badSoft: '#FDECEC',
  heroFrom: '#6D6DF0',
  heroTo: '#8B5CF6',
  shadowColor: '#1B1D33',
}

const dark: Palette = {
  canvas: '#0B0B12',
  canvasDeep: '#07070C',
  surface: '#15161F',
  surfaceAlt: '#1C1D28',
  glass: 'rgba(21,22,31,0.72)',
  line: '#252734',
  lineStrong: '#32354A',
  ink: '#F2F3F8',
  inkMuted: '#9EA1B8',
  inkFaint: '#6A6D84',
  accent: '#8B8BF5',
  accentFrom: '#7C7CF0',
  accentTo: '#A78BFA',
  accentSoft: '#1E1D3D',
  onAccent: '#0B0B12',
  good: '#4ADE80',
  goodSoft: '#10241A',
  warn: '#FBBF24',
  warnSoft: '#2A1F0E',
  bad: '#F87171',
  badSoft: '#2B1414',
  heroFrom: '#5B5BD6',
  heroTo: '#7C3AED',
  shadowColor: '#000000',
}

export const palettes: Record<Scheme, Palette> = { light, dark }

/** 4pt rhythm. Generous by default — crowding is the enemy of confidence. */
export const space = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 40, '5xl': 56,
} as const

/**
 * Deliberately very round. Nothing in this app has a hard corner: soft shapes read as
 * touchable and friendly, and they lower the "I might break it" anxiety that stops
 * hesitant users from tapping at all.
 */
export const radius = {
  sm: 16, md: 20, lg: 26, card: 30, xl: 36, pill: 999,
} as const

/** Base is 17, not 16 — a measurable legibility gain for hesitant readers. */
export const font = {
  xs: 13, sm: 15, base: 17, lg: 19, xl: 22, '2xl': 27, '3xl': 34, '4xl': 42,
} as const

export const weight = {
  regular: '400', medium: '500', semibold: '600', bold: '700',
} as const

/** Minimum comfortable touch target. Nothing interactive may be smaller. */
export const TAP = 48

/**
 * Elevation tiers. RN needs platform-split shadow props, so they are baked here once
 * rather than recomputed at every call site.
 */
export function elevation(level: 0 | 1 | 2 | 3, scheme: Scheme) {
  if (level === 0) return {}
  const isDark = scheme === 'dark'
  const color = palettes[scheme].shadowColor
  // Wide, low-opacity shadows: the surface should look like it is resting on the page
  // rather than cut out of it. Depth replaces borders entirely.
  const specs = {
    1: { o: isDark ? 0.40 : 0.05, r: 18, y: 6, e: 3 },
    2: { o: isDark ? 0.50 : 0.08, r: 32, y: 14, e: 8 },
    3: { o: isDark ? 0.62 : 0.12, r: 52, y: 24, e: 16 },
  }[level]
  return Platform.select({
    ios: {
      shadowColor: color,
      shadowOpacity: specs.o,
      shadowRadius: specs.r,
      shadowOffset: { width: 0, height: specs.y },
    },
    android: { elevation: specs.e },
    default: {},
  })
}

/**
 * Spring presets for Reanimated. Short, confident, never bouncy enough to feel like a toy.
 * `press` is the tactile scale on tap; `enter` is for content arriving.
 */
/**
 * Springs with real give. `press` is under-damped on purpose so a tap squashes and rebounds
 * like something soft, and `enter` lets content arrive with a gentle overshoot. This is the
 * main thing that makes the interface feel tactile rather than administrative.
 */
export const spring = {
  press: { damping: 17, stiffness: 260, mass: 0.75 },
  enter: { damping: 16, stiffness: 120, mass: 0.9 },
  gentle: { damping: 20, stiffness: 80, mass: 1 },
  bouncy: { damping: 12, stiffness: 170, mass: 0.85 },
} as const

/**
 * Continuous corner curvature — the iOS "squircle".
 *
 * A plain `borderRadius` is a circular arc, which visibly kinks where it meets the straight
 * edge. `borderCurve: 'continuous'` blends the curvature instead, so a rounded shape reads
 * as one smooth outline rather than a rectangle with quarter-circles bolted on. It is the
 * cheapest single improvement to how soft the interface feels, and it costs nothing at
 * runtime. No-ops on platforms that do not support it.
 */
export const smoothCorner = { borderCurve: 'continuous' } as const

export const duration = { fast: 140, base: 220, slow: 340 } as const
