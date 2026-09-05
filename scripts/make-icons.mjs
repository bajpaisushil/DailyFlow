/**
 * Generates every app icon from the Orbit mark.
 *
 * Run with: node scripts/make-icons.mjs
 *
 * Kept as a script rather than committed-only binaries so the icon set can be regenerated
 * from the single source of truth (the SVG below) if the brand ever changes.
 */
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const INDIGO = '#6D6DF0'
const VIOLET = '#8B5CF6'

/** The Orbit mark: you at the centre, your places and routines circling you. */
function mark({ stroke = '#fff', dot = '#fff', scale = 1 } = {}) {
  const w = 7.5 * scale
  return `
    <ellipse cx="50" cy="50" rx="35" ry="15" fill="none" stroke="${stroke}"
             stroke-width="${w}" opacity="0.62" transform="rotate(-28 50 50)"/>
    <circle cx="50" cy="50" r="${12.5 * scale}" fill="${dot}"/>`
}

const gradient = `
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${INDIGO}"/>
      <stop offset="1" stop-color="${VIOLET}"/>
    </linearGradient>
  </defs>`

/** Full icon: gradient plate plus the mark. Square — the OS applies its own mask. */
const fullIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${gradient}
  <rect width="100" height="100" fill="url(#g)"/>
  ${mark()}
</svg>`

/**
 * Android adaptive foreground. The launcher crops to a circle and applies parallax, so the
 * mark is scaled to ~62% and centred inside the safe zone.
 */
const adaptiveForeground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(50 50) scale(0.62) translate(-50 -50)">
    ${mark()}
  </g>
</svg>`

const adaptiveBackground = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  ${gradient}
  <rect width="100" height="100" fill="url(#g)"/>
</svg>`

/** Monochrome (Android themed icons): a single-colour silhouette on transparency. */
const monochrome = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(50 50) scale(0.62) translate(-50 -50)">
    ${mark({ stroke: '#000', dot: '#000' })}
  </g>
</svg>`

/** Splash mark sits on the app's dark canvas, so it is drawn light with no plate. */
const splash = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <g transform="translate(50 50) scale(0.8) translate(-50 -50)">
    ${mark()}
  </g>
</svg>`

const png = (svg, size) =>
  sharp(Buffer.from(svg)).resize(size, size, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png()

const targets = [
  ['assets/icon.png', fullIcon, 1024],
  ['assets/android-icon-foreground.png', adaptiveForeground, 1024],
  ['assets/android-icon-background.png', adaptiveBackground, 1024],
  ['assets/android-icon-monochrome.png', monochrome, 1024],
  ['assets/splash-icon.png', splash, 512],
  ['assets/favicon.png', fullIcon, 96],
]

await mkdir('assets', { recursive: true })

for (const [path, svg, size] of targets) {
  await png(svg, size).toFile(path)
  console.log(`  ${path}  ${size}x${size}`)
}

console.log('\nIcons generated from the Orbit mark.')
