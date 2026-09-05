# DailyFlow

A privacy-first, offline, on-device daily assistant.

You tell it what you normally do, where you go, and what you carry. It reminds you at the
right moment — including when the app is completely closed.

**Nothing you put in DailyFlow ever leaves your phone.** There is no account, no server, and
no network layer in the application at all.

---

## Run it

```bash
npm install
npx expo start
```

Notifications and geofencing are native capabilities, so they need a **development build**
rather than Expo Go:

```bash
npx expo run:android      # needs Android Studio
npx expo run:ios          # needs Xcode
```

Regenerate the app icons from the Orbit mark at any time:

```bash
node scripts/make-icons.mjs
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

## Your data

- **Save a copy** — writes a JSON backup and hands it to the share sheet. Where it goes is
  your choice; DailyFlow itself uploads nothing.
- **Open a saved copy** — validates the file before writing anything.
- **Space used** — measured from the database, not estimated.
- **Remove everything** — genuinely everything.
