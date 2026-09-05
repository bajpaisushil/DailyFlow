import React from 'react'
import { Text as RNText, type TextProps, type TextStyle } from 'react-native'
import { font, weight } from '@/theme/tokens'
import { useColors } from '@/theme/ThemeProvider'

export type TextVariant =
  | 'display'   // the one big number/greeting on a screen
  | 'title'     // screen title
  | 'heading'   // section heading
  | 'body'      // default reading size
  | 'label'     // the always-visible word under an icon
  | 'caption'   // secondary helper text

export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'good' | 'warn' | 'bad' | 'onAccent'

interface Props extends TextProps {
  variant?: TextVariant
  tone?: TextTone
  center?: boolean
}

/**
 * Optical tracking tightens as size grows — large text set at neutral tracking reads loose,
 * small text set tight reads cramped. `label` and `caption` share a size on purpose and are
 * told apart by weight, which is why 600 was removed from the scale (see tokens.ts).
 */
const VARIANTS: Record<TextVariant, TextStyle> = {
  display: { fontSize: font['3xl'], fontWeight: weight.bold, letterSpacing: -1.0, lineHeight: font['3xl'] * 1.12 },
  title: { fontSize: font['2xl'], fontWeight: weight.bold, letterSpacing: -0.6, lineHeight: font['2xl'] * 1.18 },
  heading: { fontSize: font.lg, fontWeight: weight.semibold, letterSpacing: -0.3, lineHeight: font.lg * 1.28 },
  body: { fontSize: font.base, fontWeight: weight.regular, letterSpacing: -0.1, lineHeight: font.base * 1.45 },
  label: { fontSize: font.sm, fontWeight: weight.semibold, lineHeight: font.sm * 1.3 },
  caption: { fontSize: font.sm, fontWeight: weight.regular, lineHeight: font.sm * 1.42 },
}

/**
 * All text goes through here so the type scale and tone vocabulary stay consistent.
 * `allowFontScaling` is deliberately left on: users who enlarge system text need it to work.
 */
export function Text({ variant = 'body', tone = 'default', center, style, ...rest }: Props) {
  const c = useColors()
  const color = {
    default: c.ink, muted: c.inkMuted, faint: c.inkFaint, accent: c.accent,
    good: c.good, warn: c.warn, bad: c.bad, onAccent: c.onAccent,
  }[tone]

  return (
    <RNText
      {...rest}
      maxFontSizeMultiplier={1.8}
      style={[VARIANTS[variant], { color }, center && { textAlign: 'center' }, style]}
    />
  )
}
