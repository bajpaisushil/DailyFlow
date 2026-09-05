/**
 * The gloss highlight's contrast contract.
 *
 * Kept in a plain .ts module (no JSX) so the constants can be verified by the test suite,
 * and so the numbers live next to the palette they were solved against.
 *
 * Why the stops look so specific: a white highlight lightens whatever is beneath it, and on
 * an accent fill the label on top is also white. Measured against the shipped gradient
 * stops, a uniform white overlay at 20% drops a white label to ~3.6:1 and at 34% to ~2.8:1 —
 * both below WCAG AA. The maximum uniform alpha that keeps every stop at AA is 0.053.
 *
 * So the highlight is confined to the top edge, where the three-dimensional cue actually
 * comes from, and must stay at or below LABEL_BAND_MAX_ALPHA anywhere a centred label sits.
 */

/** No stop inside the label band may exceed this, or white labels fall below AA. */
export const LABEL_BAND_MAX_ALPHA = 0.05

/** Where a vertically centred label can sit, as a fraction of the surface height. */
export const LABEL_BAND: readonly [number, number] = [0.28, 0.72]

/** Highlight stops as [position, alpha], bright only at the very top edge. */
export const HIGHLIGHT_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0.0, 0.30],
  [0.10, 0.17],
  [0.20, 0.08],
  [0.28, 0.05],
  [1.0, 0.0],
]

/** The lower shade. Darkening a surface can only raise a white label's contrast. */
export const SHADE_STOPS: ReadonlyArray<readonly [number, number]> = [
  [0.55, 0.0],
  [1.0, 0.14],
]
