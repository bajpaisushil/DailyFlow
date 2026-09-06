# DailyFlow

A privacy-first, offline, on-device daily assistant.

You tell it what you normally do, where you go, and what you carry. It reminds you at the
right moment — including when the app is completely closed.

**Nothing you put in DailyFlow ever leaves your phone.** There is no account, no server, and
no network layer in the application at all.

---

## Run it on your phone

### Quick look — Expo Go (2 minutes, no build)

```bash
npm install
npx expo start
```

Scan the QR code with the **Expo Go** app. You get the whole interface, all your lists, day
plans, places, storage and export.

Two things genuinely do not work in Expo Go, and the app says so on screen rather than
pretending: **place reminders** (Expo Go cannot register background tasks) and some
**scheduled reminder** behaviour. Expo Go is a shared sandbox app, not DailyFlow.

### The real thing — a development build (everything works)

This is the one that fires reminders with the app fully closed and watches your places.

**No Android Studio needed** — EAS builds it in the cloud and gives you an APK to install:

```bash
npx eas login                                    # a free Expo account
npx eas build --profile development --platform android
```

Install the APK it gives you, then:

```bash
npx expo start --dev-client
```

Scan the QR with the **DailyFlow** app you just installed (not Expo Go).

**If you do have Android Studio / Xcode**, plug the phone in and skip the cloud:

```bash
npx expo run:android --device
npx expo run:ios --device
```

### Build a shareable APK

Everything happens on your machine — no Expo account, no cloud build, nothing uploaded:

```bash
./scripts/build-apk.sh
```

It produces `DailyFlow.apk` in the project root. Send that file to anyone; they may need to
allow "install from unknown sources" once.

To include the map on Android, pass a Google Maps key (iOS uses Apple Maps and needs none):

```bash
GOOGLE_MAPS_API_KEY=... ./scripts/build-apk.sh
```

**Keep `dailyflow-release.keystore`.** An update can only replace an installed app if it is
signed with the same key. It is gitignored, so back it up somewhere yourself.

### Other commands

```bash
npm test                      # 105 tests, no framework — Node's built-in runner
npx tsc --noEmit              # strict typecheck
node scripts/make-icons.mjs   # regenerate every icon from the Orbit mark
```

---

## What the phone can actually do

The app never claims a capability it does not have. `CapabilityBadge` reads the real
permission state at runtime and says so in plain words.

| Capability | Works when DailyFlow is closed? | Needs a server? |
|---|---|---|
| Reminder at a set time | ✅ Yes — scheduled in the OS | ❌ No |
| "You have arrived at work" | ✅ Yes — OS region monitoring | ❌ No |
| Lists, day plans, places | ✅ Always, offline | ❌ No |

In **Expo Go** the first two rows do not work — it cannot register background tasks. The app
detects this and tells you in plain words instead of failing silently.

This is why the project is a native app rather than a PWA. On the web both rows above are
impossible: the W3C Geolocation spec forbids position updates to a non-visible document,
Chrome cancelled the Notification Triggers API, and RFC 8030 Web Push has no
scheduled-delivery header — so a serverless web app cannot ring you at 06:45.

---

## Architecture

```
app/                      screens (expo-router)
  (tabs)/                 Today · Places · Day plans · Lists · More
  place/[id]              place editor — GPS capture, no map, works offline
  plan/[id]               day plan editor — the 20-second flow
  list/[id]               list editor
  reminders               every rule, rendered as plain sentences
  settings · storage · history · commute

src/
  lib/
    types.ts              the domain model
    strings.ts            every user-facing word, in one typed dictionary
    db/                   SQLite document store + typed repositories
    engine/
      compile.ts          Day plan  ->  automations
      governance.ts       the anti-spam decision pipeline
      sentence.ts         rules rendered as human sentences
      apply.ts / boot.ts  persistence -> OS schedule reconciliation
    notify/scheduler.ts   OS-level local notification scheduling
    location/             foreground fixes + background geofencing
    data/                 seed · backup (export/import) · storage report
  components/ui/          the design system
  theme/                  tokens + provider
```

### Two decisions worth knowing

**A day plan is not a separate thing from a reminder — it compiles into one.**
`compileRoutine` turns the friendly questions ("which days? what time? what do you take?")
into TRIGGER → CONDITIONS → ACTIONS rules. So there is a single evaluation path, a single
firing ledger, and a single governance pipeline. Beginners never see a rule; advanced users
open `/reminders` and read the generated ones as sentences.

**Conditions are a flat list with one combinator, not a boolean tree.**
Arbitrary nesting buys a few percent more expressiveness and turns the builder into a
developer tool. The audience for this app is the reason that trade is not worth making.

### The plain-language rule

Every user-facing string lives in `src/lib/strings.ts`. The vocabulary is deliberate and is
grounded in W3C COGA, ISO 24495-1 plain language, NN/g's icon research, and ICT4D work on
text-free interfaces:

| Never shown | Shown instead |
|---|---|
| automation, rule | Reminder |
| trigger / condition / action | When / Only if / Then |
| routine | Day plan |
| checklist | List |
| geofence, radius | Place, How close |
| notification permission | Allow reminders |

Icons never appear without their word.

---

## Choosing a place

Three ways, because one method does not fit every situation:

| | How | Offline? |
|---|---|---|
| **I am here now** | GPS, one tap | ✅ |
| **Search a place** | Type a name or address | ❌ |
| **Show on map** | Tap the map to move the pin | ❌ |

Search goes through the phone's own geocoder, so there is no API key and no service of ours
in the path. When it returns several places with the same name, they are all drawn on the map
at once — where they are is usually the only thing that tells them apart.

Whenever the pin moves, the address is looked up and offered as the name, so the common flow
is one tap and Done, with no typing at all.

The map needs a development build (`expo-maps` is a native module, absent from Expo Go) and a
Google Maps key on Android. GPS and search work everywhere, including fully offline for GPS.

## Your data

- **Save a copy** — writes a JSON backup and hands it to the share sheet. Where it goes is
  your choice; DailyFlow itself uploads nothing.
- **Open a saved copy** — validates the file before writing anything.
- **Space used** — measured from the database, not estimated.
- **Remove everything** — genuinely everything.


## Colour

The palette is solved, not chosen by eye. `src/theme/palettes.ts` holds the tokens and
`palettes.test.ts` recomputes every WCAG 2.2 contrast ratio from the shipped hex values on
every test run, so a colour tweak that makes text unreadable fails the build.

Body and secondary text clear AAA (7:1); nothing user-facing sits below AA (4.5:1). That
headroom is deliberate — this app is read slowly, in sunlight, on cheap panels.

Two findings from that work are worth recording, because both were real defects:

- The primary button's white label was failing AA against its own gradient (4.12:1). The
  test suite originally checked the label against the *solid* accent, which passed, while
  the button is actually painted with the gradient stops. `palettes.test.ts` now checks the
  stops.
- The 3D gloss highlight lightens the surface beneath a white label. A uniform 20% overlay
  drops the label to ~3.6:1. The highlight is now confined to the top edge and capped inside
  the band where a label sits; `Gloss.test.ts` enforces that contract so the effect cannot be
  turned back up.
