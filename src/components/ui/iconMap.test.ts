import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { MAP } from './iconMap.ts'

/**
 * Every glyph name must exist in the shipped font.
 *
 * The underlying icon prop is just a string, so a typo compiles cleanly and then renders an
 * empty box on a real device — the kind of defect that only shows up in a screenshot. These
 * assertions read the actual glyph maps that ship inside @expo/vector-icons.
 */
const require_ = createRequire(import.meta.url)

const GLYPHS = {
  mc: require_(
    '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json',
  ) as Record<string, number>,
  ion: require_(
    '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json',
  ) as Record<string, number>,
}

describe('icon map', () => {
  it('references only glyphs that exist in the fonts', () => {
    const missing: string[] = []
    for (const [key, def] of Object.entries(MAP)) {
      const table = GLYPHS[def.set as 'mc' | 'ion']
      if (!(def.name in table)) missing.push(`${key} -> ${def.set}:${def.name}`)
    }
    assert.deepEqual(missing, [], `glyphs not in the font: ${missing.join(', ')}`)
  })

  it('keeps content icons filled and only navigation chrome outline', () => {
    // Hairline glyphs made the icons the lightest element on every screen. Content is
    // filled; chevrons and the like stay outline so structure reads quieter than content.
    const chrome = new Set([
      'back', 'forward', 'down', 'close', 'more', 'settings', 'plus', 'check', 'circle', 'find',
    ])
    const wrongly: string[] = []
    for (const [key, def] of Object.entries(MAP)) {
      if (!chrome.has(key) && def.name.endsWith('-outline')) wrongly.push(key)
    }
    assert.deepEqual(wrongly, [], `content icons still outline: ${wrongly.join(', ')}`)
  })

  it('covers every icon the app actually asks for', () => {
    // A sanity floor: the set should not silently shrink below what screens reference.
    assert.ok(Object.keys(MAP).length >= 60, 'the icon set has shrunk unexpectedly')
  })
})
