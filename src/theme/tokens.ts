import { Platform } from 'react-native'
import { palettes, type Scheme } from './palettes'

export { palettes } from './palettes'
export type { Palette, Scheme } from './palettes'

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

/**
 * Weight 600 is deliberately absent. React Native maps numeric weights through the platform
 * font, and on Android below API 28 a 600 collapses unpredictably toward 500 or 700 — so a
 * hierarchy built on it is not reliably rendered at all. 400 / 500 / 700 are the three that
 * survive everywhere, which is why `label` and `caption` (both 15px) are separated by 700-vs-400
 * rather than by a weight that may not exist on the device.
 */
export const weight = {
  regular: '400', medium: '500', semibold: '700', bold: '700',
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
  /**
   * Contact shadows, not blurs.
   *
   * These used to be very wide and very faint (5% over 18pt), which reads as haze rather than
   * as an edge — a card looked painted on rather than resting on the page. Level 1 is now
   * tighter and darker so it behaves like the shadow an object actually casts where it meets
   * a surface. The Android elevations came down at the same time: light mode was drawing a
   * Material shadow at elevation 3 while iOS drew 5%, so the two platforms did not look like
   * the same app.
   */
  const specs = {
    1: { o: isDark ? 0.40 : 0.09, r: 14, y: 4, e: 1 },
    2: { o: isDark ? 0.50 : 0.14, r: 28, y: 12, e: 4 },
    3: { o: isDark ? 0.62 : 0.20, r: 46, y: 22, e: 10 },
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
