import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { HIGHLIGHT_STOPS, LABEL_BAND, LABEL_BAND_MAX_ALPHA } from '../../theme/gloss.ts'
import { palettes } from '../../theme/palettes.ts'

/**
 * The gloss must never cost legibility.
 *
 * A white highlight over an accent fill lightens the ground that a white label sits on.
 * Measured against the shipped gradient stops, a uniform 20% overlay drops a white label to
 * ~3.6:1. These tests pin the highlight so the three-dimensional look cannot be dialled up
 * later at the expense of the label.
 */

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(rgb: readonly number[]): number {
  return 0.2126 * channel(rgb[0]!) + 0.7152 * channel(rgb[1]!) + 0.0722 * channel(rgb[2]!)
}

function hexToRgb(hex: string): number[] {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

function contrast(a: readonly number[], b: readonly number[]): number {
  const la = luminance(a)
  const lb = luminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Source-over composite in sRGB, matching what the GPU does. */
function over(fg: readonly number[], bg: readonly number[], alpha: number): number[] {
  return [0, 1, 2].map((i) => fg[i]! * alpha + bg[i]! * (1 - alpha))
}

/** Linear interpolation of the highlight alpha at a given vertical position. */
function alphaAt(position: number): number {
  const stops = HIGHLIGHT_STOPS
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [p0, a0] = stops[i]!
    const [p1, a1] = stops[i + 1]!
    if (position >= p0 && position <= p1) {
      const t = p1 === p0 ? 0 : (position - p0) / (p1 - p0)
      return a0 + (a1 - a0) * t
    }
  }
  return stops[stops.length - 1]![1]
}

const WHITE = [255, 255, 255]

describe('gloss contrast contract', () => {
  it('decays to within the cap before the label band starts', () => {
    const [top] = LABEL_BAND
    assert.ok(
      alphaAt(top) <= LABEL_BAND_MAX_ALPHA + 1e-9,
      `alpha ${alphaAt(top)} at ${top} exceeds the ${LABEL_BAND_MAX_ALPHA} cap`,
    )
  })

  it('stays within the cap across the whole label band', () => {
    const [top, bottom] = LABEL_BAND
    for (let p = top; p <= bottom; p += 0.02) {
      assert.ok(
        alphaAt(p) <= LABEL_BAND_MAX_ALPHA + 1e-9,
        `alpha ${alphaAt(p).toFixed(4)} at position ${p.toFixed(2)} exceeds the cap`,
      )
    }
  })

  it('keeps a white label at AA on every accent stop, gloss included', () => {
    const [top, bottom] = LABEL_BAND
    for (const scheme of ['light', 'dark'] as const) {
      const p = palettes[scheme]
      for (const stop of [p.accentFrom, p.accentTo, p.heroFrom, p.heroTo]) {
        for (let pos = top; pos <= bottom; pos += 0.05) {
          const ground = over(WHITE, hexToRgb(stop), alphaAt(pos))
          const ratio = contrast(WHITE, ground)
          assert.ok(
            ratio >= 4.5,
            `${scheme} ${stop} at ${pos.toFixed(2)}: ${ratio.toFixed(2)}:1 is below AA`,
          )
        }
      }
    }
  })

  it('still has a visible highlight at the very top edge, or the effect is pointless', () => {
    assert.ok(alphaAt(0) >= 0.2, 'the top edge highlight has been flattened away')
  })

  it('decreases monotonically, so the highlight reads as light from above', () => {
    for (let i = 0; i < HIGHLIGHT_STOPS.length - 1; i += 1) {
      assert.ok(
        HIGHLIGHT_STOPS[i]![1] >= HIGHLIGHT_STOPS[i + 1]![1],
        'highlight alpha must never increase down the surface',
      )
    }
  })
})
