import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { families, FAMILY_KEYS, familyForIcon, palettes, type Palette } from './palettes.ts'

/**
 * Contrast is a guarantee, not an aspiration.
 *
 * These tests compute real WCAG 2.2 relative luminance from the shipped hex values, so a
 * colour tweak that quietly makes text unreadable fails the build. The audience for this
 * app needs more headroom than most, which is why the bar here is AA for everything and
 * AAA for primary and secondary text.
 */

function channel(c: number): number {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(fg: string, bg: string): number {
  const a = luminance(fg)
  const b = luminance(bg)
  const lo = Math.min(a, b)
  const hi = Math.max(a, b)
  return (hi + 0.05) / (lo + 0.05)
}

const AA = 4.5
const AAA = 7

/**
 * Backgrounds each foreground is genuinely drawn on in the app.
 *
 * `onAccent` is deliberately NOT tested against `accent`: those two tokens have different
 * jobs and are never composited. `accent` is the accent used as text on a normal surface;
 * `onAccent` is the label on an accent *fill*, which is always a gradient stop.
 */
function textPairs(p: Palette): Array<[string, string, string, number]> {
  return [
    ['ink on surface', p.ink, p.surface, AAA],
    ['ink on surfaceAlt', p.ink, p.surfaceAlt, AAA],
    ['ink on canvas', p.ink, p.canvas, AAA],
    ['inkMuted on surface', p.inkMuted, p.surface, AAA],
    ['inkMuted on canvas', p.inkMuted, p.canvas, AAA],
    ['inkMuted on surfaceAlt', p.inkMuted, p.surfaceAlt, AAA],
    ['inkFaint on surface', p.inkFaint, p.surface, AA],
    ['inkFaint on canvas', p.inkFaint, p.canvas, AA],
    ['inkFaint on surfaceAlt', p.inkFaint, p.surfaceAlt, AA],
    ['accent on surface', p.accent, p.surface, AA],
    ['accent on canvas', p.accent, p.canvas, AA],
    ['accent on accentSoft', p.accent, p.accentSoft, AA],
    // The primary button is painted with the GRADIENT, not the solid accent, so these are
    // the pairs a label is actually composited against. Testing only `onAccent on accent`
    // is how an inaccessible primary button slips through — it did, once.
    ['onAccent on accentFrom', p.onAccent, p.accentFrom, AA],
    ['onAccent on accentTo', p.onAccent, p.accentTo, AA],
    ['onAccent on heroFrom', p.onAccent, p.heroFrom, AA],
    ['onAccent on heroTo', p.onAccent, p.heroTo, AA],
    ['good on surface', p.good, p.surface, AA],
    ['good on goodSoft', p.good, p.goodSoft, AA],
    ['warn on surface', p.warn, p.surface, AA],
    ['warn on warnSoft', p.warn, p.warnSoft, AA],
    ['bad on surface', p.bad, p.surface, AA],
    ['bad on badSoft', p.bad, p.badSoft, AA],
  ]
}

for (const scheme of ['light', 'dark'] as const) {
  describe(`${scheme} palette contrast`, () => {
    const p = palettes[scheme]

    for (const [label, fg, bg, floor] of textPairs(p)) {
      it(`${label} meets ${floor === AAA ? 'AAA' : 'AA'}`, () => {
        const ratio = contrast(fg, bg)
        assert.ok(
          ratio >= floor,
          `${label}: ${ratio.toFixed(2)}:1 is below the ${floor}:1 floor (${fg} on ${bg})`,
        )
      })
    }

    it('keeps the three text tiers visually distinct', () => {
      // A ramp that fails this is accessible but unreadable as hierarchy.
      const ink = luminance(p.ink)
      const muted = luminance(p.inkMuted)
      const faint = luminance(p.inkFaint)
      const ascending = scheme === 'light'
      const ordered = ascending ? ink < muted && muted < faint : ink > muted && muted > faint
      assert.ok(ordered, `tiers are not monotonic: ${ink} / ${muted} / ${faint}`)
    })

    it('gives control boundaries the 3:1 WCAG 1.4.11 requires', () => {
      // lineStrong is the visible edge of an interactive control, so it is held to the
      // non-text contrast rule against every plane it can sit on. A decorative `line`
      // hairline is exempt because it never carries meaning on its own.
      for (const [label, bg] of [
        ['surface', p.surface], ['canvas', p.canvas],
        ['surfaceAlt', p.surfaceAlt], ['canvasDeep', p.canvasDeep],
      ] as const) {
        const ratio = contrast(p.lineStrong, bg)
        assert.ok(ratio >= 3, `lineStrong on ${label}: ${ratio.toFixed(2)}:1 is below 3:1`)
      }
    })

    it('keeps a semantic chip distinguishable from the page behind it', () => {
      // A "done" chip that matches the canvas is not a chip. This is a low bar by design —
      // the chip is reinforced by an icon — but it must not be literally invisible.
      for (const [label, chip] of [
        ['goodSoft', p.goodSoft], ['warnSoft', p.warnSoft], ['badSoft', p.badSoft],
      ] as const) {
        const ratio = contrast(chip, p.canvas)
        assert.ok(ratio >= 1.06, `${label} on canvas: ${ratio.toFixed(3)}:1 is invisible`)
      }
    })

    it('never uses pure black or pure white as a large ground', () => {
      // Both are harsh to read against for long periods; this app is opened every day.
      if (scheme === 'dark') {
        assert.notEqual(p.canvas.toUpperCase(), '#000000')
        assert.notEqual(p.surface.toUpperCase(), '#000000')
      } else {
        assert.notEqual(p.canvas.toUpperCase(), '#FFFFFF')
      }
    })
  })
}

describe('accent gradient', () => {
  it('travels a modest distance, so it cannot band or turn muddy', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const p = palettes[scheme]
      const delta = Math.abs(luminance(p.accentFrom) - luminance(p.accentTo))
      assert.ok(delta < 0.25, `${scheme} gradient luminance travel ${delta.toFixed(3)} is too wide`)
    }
  })
})

describe('colour families', () => {
  for (const scheme of ['light', 'dark'] as const) {
    const p = palettes[scheme]

    for (const key of FAMILY_KEYS) {
      const pair = families[scheme][key]

      it(`${scheme}/${key}: its icon reads on its own plate`, () => {
        const ratio = contrast(pair.on, pair.soft)
        assert.ok(ratio >= 4.5, `${key} on/soft: ${ratio.toFixed(2)}:1 is below AA`)
      })

      it(`${scheme}/${key}: its icon reads on a card`, () => {
        const ratio = contrast(pair.on, p.surface)
        assert.ok(ratio >= 4.5, `${key} on/surface: ${ratio.toFixed(2)}:1 is below AA`)
      })

      it(`${scheme}/${key}: the plate is distinguishable from the card it sits on`, () => {
        // Plates render inside cards, so this is the pair that matters — not the page canvas.
        const ratio = contrast(pair.soft, p.surface)
        assert.ok(ratio >= 1.08, `${key} soft/surface: ${ratio.toFixed(3)}:1 is invisible`)
      })
    }
  }

  it('gives every family a distinct plate, or the whole point is lost', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const softs = FAMILY_KEYS.map((k) => families[scheme][k].soft)
      assert.equal(new Set(softs).size, softs.length, `${scheme} has duplicate plates`)
    }
  })

  it('maps icons to families by meaning, not by hash', () => {
    // A hash gives a shop and a hospital the same colour as often as not. These should differ.
    assert.notEqual(familyForIcon('shop'), familyForIcon('hospital'))
    assert.equal(familyForIcon('work'), 'indigo')
    assert.equal(familyForIcon('metro'), familyForIcon('bus'))
    assert.equal(familyForIcon('something-unknown'), 'slate')
  })
})
