/**
 * The colour palettes, deliberately free of any React Native import so the contrast
 * guarantees can be verified by the test suite (see palettes.test.ts) rather than trusted.
 *
 * Every light-mode value here is contrast-solved, not eyeballed. The audience for this app
 * needs more headroom than most, so no user-facing text sits below WCAG AA (4.5:1) against
 * any surface it is actually drawn on — including its own tinted chip.
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
  /** Hairline separator. Decorative only — never the sole boundary of a control. */
  line: string
  /**
   * The visible boundary of an interactive control at rest. WCAG 1.4.11 requires 3:1
   * against every adjacent surface, so this is markedly darker than a decorative hairline.
   */
  lineStrong: string
  ink: string
  inkMuted: string
  inkFaint: string
  accent: string
  accentFrom: string
  accentTo: string
  /**
   * Accent tint for a selected chip or pill. At ~1.1:1 against the canvas it is far below
   * the 3:1 WCAG 1.4.11 needs, so it must NEVER be the only signal that something is
   * selected — always pair it with a glyph, a weight change, or a tick.
   */
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
  canvas: '#EFF2F8',
  canvasDeep: '#E7EAF3',
  surface: '#FBFCFF',
  surfaceAlt: '#F5F7FC',
  glass: 'rgba(251,252,255,0.72)',
  line: '#DEE2EC',
  lineStrong: '#818793',
  ink: '#1E2131',
  inkMuted: '#4C5062',
  inkFaint: '#61677A',
  // `accent` is the accent used AS TEXT (selected tab, link, active glyph).
  // `accentFrom`/`accentTo` are the gradient the primary button is painted with — a
  // different job, and the pair white labels are actually composited against.
  accent: '#4151C9',
  accentFrom: '#4158CC',
  accentTo: '#6656D7',
  accentSoft: '#E0E7FF',
  onAccent: '#FFFFFF',
  good: '#007555',
  goodSoft: '#BBF3DA',
  warn: '#985700',
  warnSoft: '#FBE3C5',
  bad: '#A9131F',
  badSoft: '#FFDFDC',
  heroFrom: '#4158CC',
  heroTo: '#6656D7',
  shadowColor: '#131832',
}

// Dark is not an inversion of light. Text is lightened until it clears the same floors
// against the darkest ground it actually sits on, the accent-as-text token is desaturated
// per Material's dark-theme guidance so it does not vibrate, and `onAccent` stays white in
// both themes — a button whose label flips polarity between morning and night never becomes
// furniture.
const dark: Palette = {
  canvas: '#101319',
  canvasDeep: '#0A0C11',
  surface: '#1A1E25',
  surfaceAlt: '#242932',
  glass: 'rgba(26,30,37,0.76)',
  line: '#2E333D',
  lineStrong: '#6B727F',
  ink: '#E8EAF1',
  inkMuted: '#BEC1CF',
  inkFaint: '#A0A6B6',
  accent: '#AEC0FF',
  accentFrom: '#4C64C3',
  accentTo: '#6B61CC',
  accentSoft: '#232B4D',
  onAccent: '#FFFFFF',
  good: '#74D8B4',
  goodSoft: '#123528',
  warn: '#FBBD67',
  warnSoft: '#3D290C',
  bad: '#F69089',
  badSoft: '#3B1C1A',
  heroFrom: '#4C64C3',
  heroTo: '#6B61CC',
  shadowColor: '#000000',
}

export const palettes: Record<Scheme, Palette> = { light, dark }
