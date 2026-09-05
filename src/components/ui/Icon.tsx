import React from 'react'
import { View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons'
import { Text } from './Text'
import { radius, smoothCorner, space } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

/**
 * Icons are glyph fonts, not SVG paths: the text engine draws them far more cheaply,
 * which matters in lists (REQUIREMENTS.md #48).
 *
 * A hard rule from the research: an icon NEVER appears without a visible word next to it.
 * NN/g's finding is that icons are ambiguous almost without exception and the label is what
 * actually carries the meaning — so `IconLabel` is the component screens should reach for.
 */

export type IconName = keyof typeof MAP

/** Concrete, everyday objects rather than abstract symbols, per the ICT4D guidance. */
const MAP = {
  home: { set: 'mc', name: 'home-variant' },
  work: { set: 'mc', name: 'briefcase-outline' },
  school: { set: 'mc', name: 'school-outline' },
  gym: { set: 'mc', name: 'dumbbell' },
  shop: { set: 'mc', name: 'cart-outline' },
  food: { set: 'mc', name: 'food-outline' },
  cafe: { set: 'mc', name: 'coffee-outline' },
  hospital: { set: 'mc', name: 'hospital-box-outline' },
  temple: { set: 'mc', name: 'town-hall' },
  family: { set: 'mc', name: 'account-group-outline' },
  friend: { set: 'mc', name: 'account-heart-outline' },
  place: { set: 'ion', name: 'location-outline' },

  bag: { set: 'mc', name: 'bag-personal-outline' },
  laptop: { set: 'mc', name: 'laptop' },
  charger: { set: 'mc', name: 'power-plug-outline' },
  wallet: { set: 'mc', name: 'wallet-outline' },
  card: { set: 'mc', name: 'card-account-details-outline' },
  keys: { set: 'mc', name: 'key-variant' },
  phone: { set: 'mc', name: 'cellphone' },
  earphones: { set: 'mc', name: 'headphones' },
  bottle: { set: 'mc', name: 'bottle-soda-classic-outline' },
  towel: { set: 'mc', name: 'hanger' },
  shoes: { set: 'mc', name: 'shoe-sneaker' },
  pills: { set: 'mc', name: 'pill' },
  umbrella: { set: 'mc', name: 'umbrella-outline' },
  book: { set: 'mc', name: 'book-open-outline' },
  passport: { set: 'mc', name: 'passport' },
  ticket: { set: 'mc', name: 'ticket-confirmation-outline' },

  walk: { set: 'mc', name: 'walk' },
  cycle: { set: 'mc', name: 'bike' },
  car: { set: 'mc', name: 'car-outline' },
  bus: { set: 'mc', name: 'bus' },
  metro: { set: 'mc', name: 'subway-variant' },
  train: { set: 'mc', name: 'train' },

  sunrise: { set: 'mc', name: 'weather-sunset-up' },
  sun: { set: 'mc', name: 'white-balance-sunny' },
  sunset: { set: 'mc', name: 'weather-sunset-down' },
  moon: { set: 'mc', name: 'weather-night' },
  clock: { set: 'ion', name: 'time-outline' },
  bell: { set: 'ion', name: 'notifications-outline' },
  bellOff: { set: 'ion', name: 'notifications-off-outline' },

  list: { set: 'ion', name: 'list-outline' },
  check: { set: 'ion', name: 'checkmark' },
  checkCircle: { set: 'ion', name: 'checkmark-circle' },
  circle: { set: 'ion', name: 'ellipse-outline' },
  plus: { set: 'ion', name: 'add' },
  close: { set: 'ion', name: 'close' },
  back: { set: 'ion', name: 'chevron-back' },
  forward: { set: 'ion', name: 'chevron-forward' },
  down: { set: 'ion', name: 'chevron-down' },
  settings: { set: 'ion', name: 'settings-outline' },
  more: { set: 'ion', name: 'ellipsis-horizontal' },
  calendar: { set: 'ion', name: 'calendar-outline' },
  repeat: { set: 'ion', name: 'repeat' },
  play: { set: 'ion', name: 'play' },
  arrive: { set: 'mc', name: 'map-marker-check-outline' },
  leave: { set: 'mc', name: 'map-marker-remove-outline' },
  battery: { set: 'mc', name: 'battery-30' },
  lock: { set: 'ion', name: 'lock-closed-outline' },
  phoneOff: { set: 'mc', name: 'cellphone-off' },
  trash: { set: 'ion', name: 'trash-outline' },
  save: { set: 'ion', name: 'download-outline' },
  open: { set: 'ion', name: 'folder-open-outline' },
  space: { set: 'mc', name: 'chart-donut' },
  history: { set: 'ion', name: 'time-outline' },
  speak: { set: 'ion', name: 'volume-high-outline' },
  mic: { set: 'ion', name: 'mic-outline' },
  sparkle: { set: 'mc', name: 'star-four-points-outline' },
  find: { set: 'ion', name: 'search-outline' },
  map: { set: 'mc', name: 'map-outline' },
  target: { set: 'mc', name: 'crosshairs-gps' },
} as const

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

/** A round tinted plate behind an icon — the app's main "object" motif. */
export function IconBadge({
  name, size = 22, color, background, plate = 44,
}: IconProps & { background?: string; plate?: number }) {
  const c = useColors()
  return (
    <View
      style={{
        width: plate,
        height: plate,
        borderRadius: plate / 2.6,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: background ?? c.accentSoft,
        ...smoothCorner,
      }}
    >
      <Icon name={name} size={size} color={color ?? c.accent} />
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
