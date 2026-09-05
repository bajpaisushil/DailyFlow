import React from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { Text } from '@/components/ui/Text'
export { describeWait } from '@/lib/today'

interface Props {
  /** Minutes until the thing happens. Negative means it has already started. */
  minutesAway: number
  /** How far ahead the ring starts filling. Beyond this it simply reads as full. */
  windowMinutes?: number
  color: string
  trackColor: string
  size?: number
}

/**
 * How long until the next thing, drawn as well as written.
 *
 * The hero used to show the departure time and leave the user to work out how long that was —
 * which is arithmetic, at a glance, first thing in the morning. The ring carries the same
 * information without requiring any reading or subtraction at all, which for a low-literacy
 * or low-numeracy reader is the difference between useful and decorative.
 *
 * No animation: `useClock` already re-renders Today once a minute, so the ring redraws itself
 * for free. A shared value and a spring here would cost frames and buy nothing.
 */
export function CountdownRing({
  minutesAway, windowMinutes = 120, color, trackColor, size = 62,
}: Props) {
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius

  // Fills as the moment approaches: empty two hours out, complete at the time itself.
  const remaining = Math.max(0, Math.min(1, minutesAway / windowMinutes))
  const progress = 1 - remaining

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={trackColor} strokeWidth={stroke} fill="none" opacity={0.35}
        />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          // Start at twelve o'clock rather than three.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="label" style={{ color, fontSize: 13 }}>
        {label(minutesAway)}
      </Text>
    </View>
  )
}

/** Short, plain, and never a bare number of minutes above an hour. */
function label(minutesAway: number): string {
  if (minutesAway <= 0) return 'now'
  if (minutesAway < 60) return `${minutesAway}m`
  const hours = Math.round(minutesAway / 60)
  return `${hours}h`
}

