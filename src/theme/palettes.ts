/**
 * The colour palettes.
 *
 * The single most load-bearing number here is the SEPARATION between `surface` and `canvas`.
 * Borders were removed from this design, so a card's edge is defined only by that step plus
 * its shadow. It used to be 1.09:1 — invisible — which is why the interface read as flat no
 * matter how much gloss or spring was added to it. It is now 1.185:1 (light) and 1.23:1
 * (dark), and the whole ink ramp and semantic triad had to move with it to keep every
 * contrast floor intact. Change any one of these and re-run palettes.test.ts; they are a set,
 * not independent knobs.
 *
 * The rest of it, deliberately free of any React Native import so the contrast
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
  canvas: '#E5E9F3',
  canvasDeep: '#D5DBEA',
  surface: '#FBFCFF',
  surfaceAlt: '#F1F4FA',
  glass: 'rgba(251,252,255,0.72)',
  line: '#DEE2EC',
  lineStrong: '#6E7480',
  ink: '#1E2131',
  inkMuted: '#454959',
  inkFaint: '#5A6072',
  // `accent` is the accent used AS TEXT (selected tab, link, active glyph).
  // `accentFrom`/`accentTo` are the gradient the primary button is painted with — a
  // different job, and the pair white labels are actually composited against.
  accent: '#4151C9',
  accentFrom: '#4158CC',
  accentTo: '#6656D7',
  accentSoft: '#E0E7FF',
  onAccent: '#FFFFFF',
  good: '#005F45',
  goodSoft: '#A6E9C9',
  warn: '#7A4600',
  warnSoft: '#F5D6AC',
  bad: '#8F0F1A',
  badSoft: '#FFD0CB',
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
  canvas: '#0C0F14',
  canvasDeep: '#07090D',
  surface: '#1E242D',
  surfaceAlt: '#2B323D',
  glass: 'rgba(26,30,37,0.76)',
  line: '#2E333D',
  lineStrong: '#7C8391',
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

/**
 * Per-item colour identity.
 *
 * `Place.colorKey` and `Routine.colorKey` were in the data model from the start and read by
 * nothing, so every icon plate in the app rendered the same pale lavender and the user's own
 * places were visually indistinguishable from each other. These families fix that.
 *
 * Colour is never load-bearing: it sits behind an icon that already has a permanently visible
 * word, so nothing is lost to a colour-blind user. It is a recognition aid — "my green one" —
 * which for a low-literacy reader is a genuine navigational shortcut, not decoration.
 *
 * Every pair is contrast-solved: `on` clears AA against both its own `soft` chip and the card
 * surface, in both schemes. palettes.test.ts asserts it.
 */
export type ColorFamily = 'indigo' | 'teal' | 'amber' | 'rose' | 'violet' | 'moss' | 'slate'

export interface FamilyPair {
  /** Icon and text drawn on the soft plate. */
  on: string
  /** The plate itself. */
  soft: string
}

export const families: Record<Scheme, Record<ColorFamily, FamilyPair>> = {
  light: {
    indigo: { on: '#3D4EC7', soft: '#DFE4FF' },
    teal:   { on: '#00695C', soft: '#C9EFE7' },
    amber:  { on: '#8A5300', soft: '#FBE6C2' },
    rose:   { on: '#AF1546', soft: '#FFDFE7' },
    violet: { on: '#6B3FBF', soft: '#EBDEFF' },
    moss:   { on: '#4A6212', soft: '#E4EFC4' },
    slate:  { on: '#3F4A5C', soft: '#DFE5EE' },
  },
  dark: {
    indigo: { on: '#B6C4FF', soft: '#28315A' },
    teal:   { on: '#6FD9C0', soft: '#0F3A32' },
    amber:  { on: '#F5BE6B', soft: '#402C0E' },
    rose:   { on: '#FF9DB4', soft: '#4A1B2B' },
    violet: { on: '#CBAAFF', soft: '#33234F' },
    moss:   { on: '#B9D268', soft: '#2A331A' },
    slate:  { on: '#B7C1D2', soft: '#2B323D' },
  },
}

export const FAMILY_KEYS: ColorFamily[] = ['indigo', 'teal', 'amber', 'rose', 'violet', 'moss', 'slate']

/**
 * Default family for an icon.
 *
 * Derived from what the thing IS rather than from a hash of its id: a hash gives a shop and a
 * hospital the same colour as often as not, which is noise. This way a user's places come out
 * looking deliberate on first creation, and they can still change it.
 */
export function familyForIcon(icon: string): ColorFamily {
  switch (icon) {
    case 'work': case 'laptop': case 'card': case 'repeat':
      return 'indigo'
    case 'metro': case 'bus': case 'train': case 'car': case 'cycle': case 'walk': case 'bottle':
      return 'teal'
    case 'shop': case 'cafe': case 'food': case 'sun': case 'sunrise':
      return 'amber'
    case 'hospital': case 'pills': case 'gym': case 'family': case 'friend':
      return 'rose'
    case 'school': case 'book': case 'temple': case 'moon':
      return 'violet'
    case 'home': case 'umbrella': case 'shoes':
      return 'moss'
    default:
      return 'slate'
  }
}
