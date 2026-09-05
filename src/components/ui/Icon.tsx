import React from 'react'
import { View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Text } from './Text'
import { radius, smoothCorner, space } from '@/theme/tokens'
import { families, familyForIcon, type ColorFamily } from '@/theme/palettes'
import { useTheme } from '@/theme/ThemeProvider'
import { useColors } from '@/theme/ThemeProvider'
import { MAP } from './iconMap'

/**
 * Icons are glyph fonts, not SVG paths: the text engine draws them far more cheaply,
 * which matters in lists (REQUIREMENTS.md #48).
 *
 * A hard rule from the research: an icon NEVER appears without a visible word next to it.
 * NN/g's finding is that icons are ambiguous almost without exception and the label is what
 * actually carries the meaning — so `IconLabel` is the component screens should reach for.
 */

export type IconName = keyof typeof MAP
export { MAP }


interface IconProps {
  name: IconName
  size?: number
  color?: string
}

export function Icon({ name, size = 22, color }: IconProps) {
  const c = useColors()
  const def = MAP[name]
  const tint = color ?? c.ink
  if (def.set === 'ion') {
    return <Ionicons name={def.name as never} size={size} color={tint} />
  }
  return <MaterialCommunityIcons name={def.name as never} size={size} color={tint} />
}

/**
 * A tinted plate behind an icon — the app's main "object" motif.
 *
 * By default the plate takes its colour from the icon's family, so a shop, a hospital and a
 * station look like different things rather than three identical lavender squares. Pass
 * `family` to override, or `background`/`color` to opt out entirely.
 */
export function IconBadge({
  name, size = 23, color, background, plate = 44, family,
}: IconProps & { background?: string; plate?: number; family?: ColorFamily }) {
  const { colors: c, scheme } = useTheme()
  const pair = families[scheme][family ?? familyForIcon(name)]
  const fill = background ?? pair.soft
  const tint = color ?? pair.on
  return (
    <View
      style={{
        width: plate,
        height: plate,
        borderRadius: plate / 2.9,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: fill,
        ...smoothCorner,
      }}
    >
      <Icon name={name} size={size} color={tint} />
    </View>
  )
}

/** Icon plus its permanently visible word. Use this instead of a bare icon in nav and choices. */
export function IconLabel({
  name, label, size = 22, color, gap = space.sm,
}: IconProps & { label: string; gap?: number }) {
  return (
    <View style={{ alignItems: 'center', gap }}>
      <Icon name={name} size={size} color={color} />
      <Text variant="label" style={color ? { color } : undefined}>
        {label}
      </Text>
    </View>
  )
}
