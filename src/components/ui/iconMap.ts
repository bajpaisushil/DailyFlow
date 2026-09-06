/**
 * The icon table, in a plain module so the test suite can verify every glyph name actually
 * exists in the shipped fonts. A typo here renders a blank box on a real device and nothing
 * catches it at compile time, because the underlying prop is just a string.
 */

/**
 * Concrete, everyday objects rather than abstract symbols, per the ICT4D guidance.
 *
 * CONTENT icons are FILLED; only navigation chrome (chevrons, close, plus, settings) stays
 * outline. Hairline glyphs at 22px were the visually lightest thing on every screen, which is
 * most of why the interface read as flat. Filled glyphs give the composition mass, and it
 * costs nothing: same font file, different codepoints.
 */
export const MAP = {
  home: { set: 'mc', name: 'home-variant' },
  work: { set: 'mc', name: 'briefcase' },
  school: { set: 'mc', name: 'school' },
  gym: { set: 'mc', name: 'dumbbell' },
  shop: { set: 'mc', name: 'cart' },
  food: { set: 'mc', name: 'food' },
  cafe: { set: 'mc', name: 'coffee' },
  hospital: { set: 'mc', name: 'hospital-box' },
  temple: { set: 'mc', name: 'town-hall' },
  family: { set: 'mc', name: 'account-group' },
  friend: { set: 'mc', name: 'account-heart' },
  place: { set: 'ion', name: 'location' },

  bag: { set: 'mc', name: 'bag-personal' },
  laptop: { set: 'mc', name: 'laptop' },
  charger: { set: 'mc', name: 'power-plug' },
  wallet: { set: 'mc', name: 'wallet' },
  card: { set: 'mc', name: 'card-account-details' },
  keys: { set: 'mc', name: 'key-variant' },
  phone: { set: 'mc', name: 'cellphone' },
  earphones: { set: 'mc', name: 'headphones' },
  bottle: { set: 'mc', name: 'bottle-soda-classic' },
  towel: { set: 'mc', name: 'hanger' },
  shoes: { set: 'mc', name: 'shoe-sneaker' },
  pills: { set: 'mc', name: 'pill' },
  umbrella: { set: 'mc', name: 'umbrella' },
  book: { set: 'mc', name: 'book-open' },
  passport: { set: 'mc', name: 'passport' },
  ticket: { set: 'mc', name: 'ticket-confirmation' },

  walk: { set: 'mc', name: 'walk' },
  cycle: { set: 'mc', name: 'bike' },
  car: { set: 'mc', name: 'car' },
  bus: { set: 'mc', name: 'bus' },
  metro: { set: 'mc', name: 'subway-variant' },
  train: { set: 'mc', name: 'train' },

  sunrise: { set: 'mc', name: 'weather-sunset-up' },
  sun: { set: 'mc', name: 'white-balance-sunny' },
  sunset: { set: 'mc', name: 'weather-sunset-down' },
  moon: { set: 'mc', name: 'weather-night' },
  clock: { set: 'ion', name: 'time' },
  bell: { set: 'ion', name: 'notifications' },
  bellOff: { set: 'ion', name: 'notifications-off' },

  list: { set: 'ion', name: 'list' },
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
  calendar: { set: 'ion', name: 'calendar' },
  repeat: { set: 'ion', name: 'repeat' },
  copy: { set: 'ion', name: 'copy-outline' },
  play: { set: 'ion', name: 'play' },
  // Pause and stop are distinct on purpose: pausing keeps your place in a long recording,
  // stopping gives it up. One control doing both is what made the preview unusable.
  pause: { set: 'ion', name: 'pause' },
  stop: { set: 'ion', name: 'stop' },
  arrive: { set: 'mc', name: 'map-marker-check' },
  leave: { set: 'mc', name: 'map-marker-remove' },
  battery: { set: 'mc', name: 'battery-30' },
  lock: { set: 'ion', name: 'lock-closed' },
  phoneOff: { set: 'mc', name: 'cellphone-off' },
  trash: { set: 'ion', name: 'trash' },
  save: { set: 'ion', name: 'download' },
  open: { set: 'ion', name: 'folder-open' },
  space: { set: 'mc', name: 'chart-donut' },
  history: { set: 'ion', name: 'time' },
  speak: { set: 'ion', name: 'volume-high' },
  mic: { set: 'ion', name: 'mic' },
  sparkle: { set: 'mc', name: 'star-four-points' },
  find: { set: 'ion', name: 'search-outline' },
  map: { set: 'mc', name: 'map' },
  target: { set: 'mc', name: 'crosshairs-gps' },
} as const
