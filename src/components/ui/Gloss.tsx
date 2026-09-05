import React from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { radius as R } from '@/theme/tokens'
import { HIGHLIGHT_STOPS, SHADE_STOPS } from '@/theme/gloss'

export { HIGHLIGHT_STOPS, LABEL_BAND, LABEL_BAND_MAX_ALPHA } from '@/theme/gloss'

/**
 * The specular highlight that makes a surface read as a rounded three-dimensional object
 * rather than a flat coloured rectangle.
 *
 * CONTRAST CONTRACT — the reason the stops look so specific:
 *
 * A white gloss lightens whatever is beneath it, and on an accent fill the label sitting on
 * top is also white. Measured against the shipped gradient stops, a uniform white overlay at
 * 20% drops a white label to ~3.6:1 and at 34% to ~2.8:1 — both below WCAG AA. The maximum
 * uniform alpha that keeps every stop at AA is 0.053.
 *
 * So the highlight is confined to the top edge, where the three-dimensional cue actually
 * comes from, and is required to be at or below LABEL_BAND_MAX_ALPHA everywhere a centred
 * label can sit (roughly 28%–72% of the height). Below the midpoint the overlay darkens
 * instead, which only ever helps a white label.
 *
 * `Gloss.test.ts` asserts this contract, so the effect cannot be turned up later without
 * the build failing.
 */


interface Props {
  /** Match the parent's corner radius so the highlight follows the same outline. */
  radius?: number
  /**
   * `soft` for large surfaces, `strong` for small controls. Both obey the contract above;
   * `strong` simply keeps the top edge brighter for longer before it decays.
   */
  intensity?: 'soft' | 'strong'
}

export function Gloss({ radius = R.card, intensity = 'soft' }: Props) {
  const scale = intensity === 'strong' ? 1 : 0.7

  // expo-linear-gradient types colours as a non-empty tuple; both stop lists are
  // compile-time constants with at least two entries, so the assertion is safe.
  const highlight = HIGHLIGHT_STOPS.map(
    ([, a]) => `rgba(255,255,255,${(a * scale).toFixed(3)})`,
  ) as unknown as readonly [string, string, ...string[]]
  const highlightAt = HIGHLIGHT_STOPS.map(([pos]) => pos) as unknown as readonly [number, number, ...number[]]
  const shade = SHADE_STOPS.map(
    ([, a]) => `rgba(0,0,0,${(a * scale).toFixed(3)})`,
  ) as unknown as readonly [string, string, ...string[]]
  const shadeAt = SHADE_STOPS.map(([pos]) => pos) as unknown as readonly [number, number, ...number[]]

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
    >
      <LinearGradient
        colors={highlight}
        locations={highlightAt}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={shade}
        locations={shadeAt}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}
