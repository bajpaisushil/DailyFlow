import React from 'react'
import { View, StyleSheet, ScrollView } from 'react-native'
import { Text } from './Text'
import { Icon, type IconName } from './Icon'
import { PressableScale } from './PressableScale'
import { space, radius } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

interface Props {
  value: string
  onChange: (icon: IconName) => void
  set?: 'place' | 'thing' | 'plan'
}

/**
 * A grid of concrete, everyday objects — a house, a bag, a bus — rather than abstract
 * glyphs, and every tile carries its word. There is deliberately no search box, because a
 * search box demands spelling.
 */
const SETS: Record<NonNullable<Props['set']>, Array<{ icon: IconName; label: string }>> = {
  place: [
    { icon: 'home', label: 'Home' }, { icon: 'work', label: 'Work' },
    { icon: 'school', label: 'School' }, { icon: 'gym', label: 'Gym' },
    { icon: 'shop', label: 'Shop' }, { icon: 'cafe', label: 'Cafe' },
    { icon: 'food', label: 'Food' }, { icon: 'hospital', label: 'Doctor' },
    { icon: 'temple', label: 'Temple' }, { icon: 'family', label: 'Family' },
    { icon: 'friend', label: 'Friend' }, { icon: 'metro', label: 'Station' },
    { icon: 'bus', label: 'Bus stop' }, { icon: 'place', label: 'Other' },
  ],
  thing: [
    { icon: 'phone', label: 'Phone' }, { icon: 'keys', label: 'Keys' },
    { icon: 'wallet', label: 'Wallet' }, { icon: 'card', label: 'Card' },
    { icon: 'laptop', label: 'Laptop' }, { icon: 'charger', label: 'Charger' },
    { icon: 'bag', label: 'Bag' }, { icon: 'bottle', label: 'Bottle' },
    { icon: 'earphones', label: 'Earphones' }, { icon: 'shoes', label: 'Shoes' },
    { icon: 'towel', label: 'Towel' }, { icon: 'pills', label: 'Medicine' },
    { icon: 'umbrella', label: 'Umbrella' }, { icon: 'book', label: 'Book' },
    { icon: 'passport', label: 'Passport' }, { icon: 'ticket', label: 'Ticket' },
    { icon: 'food', label: 'Food' }, { icon: 'list', label: 'Other' },
  ],
  plan: [
    { icon: 'work', label: 'Work' }, { icon: 'school', label: 'School' },
    { icon: 'gym', label: 'Gym' }, { icon: 'sunrise', label: 'Morning' },
    { icon: 'moon', label: 'Night' }, { icon: 'shop', label: 'Shopping' },
    { icon: 'metro', label: 'Travel' }, { icon: 'pills', label: 'Medicine' },
    { icon: 'book', label: 'Study' }, { icon: 'family', label: 'Family' },
    { icon: 'food', label: 'Meal' }, { icon: 'repeat', label: 'Other' },
  ],
}

export function IconPicker({ value, onChange, set = 'thing' }: Props) {
  const c = useColors()
  const options = SETS[set]

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {options.map((opt) => {
        const active = value === opt.icon
        return (
          <PressableScale
            key={opt.icon}
            onPress={() => onChange(opt.icon)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={opt.label}
            style={[
              styles.tile,
              { backgroundColor: active ? c.accentSoft : c.surfaceAlt },
            ]}
          >
            <Icon name={opt.icon} size={26} color={active ? c.accent : c.inkMuted} />
            <Text variant="label" style={{ color: active ? c.accent : c.inkMuted, fontSize: 12 }}>
              {opt.label}
            </Text>
            {/* A tint alone is below the contrast a state indicator needs, so the chosen
                tile also carries a tick. */}
            {active ? (
              <View style={[styles.tick, { backgroundColor: c.accent }]}>
                <Icon name="check" size={12} color={c.onAccent} />
              </View>
            ) : null}
          </PressableScale>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.xs, paddingRight: space.xl },
  tile: {
    width: 88, height: 88, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center', gap: space.xs,
  },
  tick: {
    position: 'absolute', top: 6, right: 6,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
})
