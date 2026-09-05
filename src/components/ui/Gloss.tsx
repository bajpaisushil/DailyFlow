import React from 'react'
import { StyleSheet, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { radius as R } from '@/theme/tokens'

/**
 * The specular highlight that makes a surface read as a rounded three-dimensional object
 * rather than a flat coloured rectangle.
 *
 * Two overlaid gradients do the work:
 *  - a bright top band, sharpest at the very top edge, standing in for light falling on a
 *    curved surface;
 *  - a soft dark bottom band, giving the shape a grounded underside.
 *
 * Purely decorative and non-interactive: it never affects layout, never intercepts touches,
 * and nothing about understanding the screen depends on seeing it.
 */
interface Props {
  /** Match the parent's corner radius so the highlight follows the same outline. */
  radius?: number
  /** How pronounced the effect is. `soft` for large surfaces, `strong` for small controls. */
  intensity?: 'soft' | 'strong'
}

export function Gloss({ radius = R.card, intensity = 'soft' }: Props) {
  const top = intensity === 'strong' ? 0.34 : 0.2
  const bottom = intensity === 'strong' ? 0.16 : 0.1

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}
    >
      <LinearGradient
        colors={[`rgba(255,255,255,${top})`, 'rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
        locations={[0, 0.42, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0)', `rgba(0,0,0,${bottom})`]}
        locations={[0.55, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  )
}
