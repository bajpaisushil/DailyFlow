# DailyFlow — Requirements Queue

> Living source of truth. Every instruction from the user is appended here, in order, and never dropped.
> Status: `locked` = decided, `building` = in progress, `done` = shipped & verified.

## A. Product identity

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 1 | App is named **DailyFlow** | msg 1 | locked |
| 2 | A privacy-first, context-aware **personal assistant**, not a to-do list or calendar | msg 1 | locked |
| 3 | Feels like a "personal operating system", not enterprise task software | msg 1 | locked |

## B. Hard constraints

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 4 | **No backend. No server. No login. No account.** | msg 1, 2 | locked |
| 5 | **Frontend only** — explicitly confirmed | msg 2 | locked |
| 6 | Nothing personal ever leaves the device. No location upload, no routine upload. | msg 1 | locked |
| 7 | Local-first / offline-first. Fully usable with no network. | msg 1 | locked |

## C. Stack (user-directed)

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 8 | ~~Next.js~~ → **React Native (Expo)** — user chose native for "full control" after learning a PWA cannot fire reminders when fully closed | msg 3, msg 8 | locked |
| 9 | **TypeScript**, strict | msg 1, 3 | locked |
| 10 | ~~Tailwind v4~~ → **RN StyleSheet + typed tokens.** NativeWind was installed then removed: it resolves styles at render time, and #15/#48 demand the compiled path. Same token vocabulary, zero runtime cost. | msg 3, msg 9 | locked |
| 11 | ~~Framer Motion~~ → **Reanimated 4** (RN's equivalent; runs on the UI thread, which Framer Motion cannot do in RN) | msg 3 | locked |
| 12 | Three.js *only if required*. Assessment: **not required** — ~600KB would fight "fast" + "calm/minimal". Skipped unless user names a specific place for it. | msg 3 | locked |
| 13 | IndexedDB via **Dexie**; **Zustand** for state | msg 1 | locked |
| 14 | Avoid unnecessary dependencies | msg 1 | locked |

## D. Performance

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 15 | **Very optimal and fast** — explicit user emphasis | msg 4 | locked |
| 16 | Static export (`output: 'export'`) — no server runtime at all | derived from #4 | locked |

## E. UX (highest-priority constraint)

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 17 | **Very simple UI/UX — usable by even less-literate people.** Everything else bends to this. | msg 1 (closing), reaffirmed | locked |
| 18 | Minimal, modern, calm, premium, spacious, mobile-first | msg 1 | locked |
| 19 | NOT colorful, NOT dashboard-heavy, NOT corporate, NOT cluttered | msg 1 | locked |
| 20 | Simple things extremely simple; advanced power hidden underneath (progressive disclosure) | msg 1 | locked |
| 21 | Create "weekday 6:45 AM, if home, remind me of Office checklist" in **under 20 seconds** | msg 1 | locked |
| 22 | Advanced multi-condition automation buildable **without touching code** | msg 1 | locked |
| 23 | Navigation: Today / Places / Routines / Checklists / More; desktop sidebar; optional command palette | msg 1 | locked |

## F. Core architecture

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 24 | **TRIGGER → CONDITIONS → ACTIONS** automation model | msg 1 | locked |
| 25 | Extensible later **without rewriting the architecture** (registry pattern) | msg 1 | locked |
| 26 | Sections: Today, Places, Routines, Checklists, Automations | msg 1 | locked |
| 27 | **Commute Mode** (not a navigation app — help use commute time well) | msg 1 | locked |
| 28 | Data model: Preferences, Places, Routines, Checklists, Items, Automations, Triggers, Conditions, Actions, NotificationPrefs, CommuteProfiles, ActivityHistory, AppSettings | msg 1 | locked |

## G. Notifications

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 29 | Customizable: title, message, sound, vibration, timing, frequency, snooze, priority | msg 1 | locked |
| 30 | Permission onboarding that explains *why*. **Never aggressive.** | msg 1 | locked |
| 31 | Anti-spam: quiet hours, priority, snooze, dedupe, context suppression, "not again today", completed-task suppression, user-defined limits | msg 1 | locked |
| 32 | **No server for time notifications.** Foreground timer + catch-up reconciliation. | msg 6 | locked |
| 33 | **`.ics` / phone-alarm export bridge** — generated fully on-device so the OS gives a *guaranteed* alarm even when DailyFlow is closed | msg 6 (my proposal, accepted context) | locked |
| 34 | **Never show a reminder as "scheduled" if it cannot actually fire.** Plain-word capability badges. | msg 1, msg 6 | locked |

## H. Location

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 35 | Progressive enhancement: strongest supported capability, graceful degradation | msg 1 | locked |
| 36 | **Never pretend a location trigger fired if it could not be evaluated** | msg 1 | locked |
| 37 | Battery-conscious. No needless GPS polling. | msg 1 | locked |
| 38 | Clearly communicate limits to the user in plain words | msg 1 | locked |

## I. Data ownership

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 39 | Export all data / Import / Local backup / Reset / Delete all | msg 1 | locked |
| 40 | IndexedDB for structured data (not just localStorage) | msg 1 | locked |
| 41 | **Show the user how much storage the app occupies on their device** | msg 5 | locked |

## J. PWA

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 42 | Serious PWA: manifest, service worker, offline, installability, app-shell caching, icons, splash, update handling | msg 1 | locked |
| 43 | Separate universally-supported features from browser/OS-dependent ones, visibly | msg 1 | locked |

## K. Process

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 44 | Deliver the 10 design artifacts (name, vision, journeys, MVP, architecture, data model, engine, limits, UI/UX, roadmap) **then** implement | msg 1 | building |
| 45 | Improve the product — propose and add better ideas, don't blindly follow the list | msg 1 | locked |
| 46 | **Queue every instruction so nothing is forgotten** — this file | msg 4, msg 5 | done |

## L. Architect-for (not necessarily v1)

Weather-aware reminders · Calendar integration · Transit info · Smart commute suggestions · Habit tracking ·
Sleep/wake routines · Battery-aware reminders · Bluetooth/device context · NFC triggers · QR triggers ·
Voice input · Voice reminders · Local AI · Smart checklist generation · Routine suggestions ·
"You usually do X" insights · Travel mode · Packing lists · Shopping mode · Medication categories ·
Family/shared routines (only if cloud sync is ever introduced).

Rule: **do not add backend-requiring features for the sake of complexity.**


---

# Added during the build

| # | Requirement | Source | Status |
|---|-------------|--------|--------|
| 47 | **Instantly usable on first open, "like Google apps"** — no setup wall; depth revealed progressively | msg 10 | done — seeded starter lists, Today works from second one, permissions asked only in context |
| 48 | **Use the most optimal library, or the core primitive, if anything slows down even a little** | msg 9 | done — dropped NativeWind + MMKV + Lucide SVG icons in favour of StyleSheet, sync SQLite and glyph fonts |
| 49 | **No map-tile dependency** — creating a place must work with zero internet | derived from #7 | done — "I am here now" GPS capture, no map |
| 50 | **Soft, pillowy, candy-like UI — no hard boundaries** | msg 12 | done — borders removed everywhere; depth from fill + soft shadow; radii up; springs given real give |
| 51 | **Bubble/balloon navigation** that invites tapping | msg 14 | done — custom `BubbleTabBar`, gradient bubble springs between tabs on the UI thread |
| 52 | **Smoother than bubbles/balloons/candy crush** | msg 16 | done — continuous (squircle) corners, softened springs, longer screen transitions, `freezeOnBlur` |
| 53 | **Very modern 3D look** | msg 17 | done — `Gloss` specular highlight layer on accent surfaces, layered gradients, dual-tone depth |
| 54 | **Research the best colour combination so the user gets used to it** | msg 18 | in progress — evidence-based palette + WCAG verification running |
| 55 | **Show logos as files in the repo, not as links** | msg 13 | done — `assets/logos/*.svg` + `preview.html` |
| 56 | **Logo: Orbit mark**, used everywhere in and outside the app | msg 15 | done — full icon set generated by `scripts/make-icons.mjs` |

## Capability change from going native

Switching from PWA to React Native was decided after verified research (W3C Geolocation spec,
Chrome's own Notification Triggers cancellation notice, RFC 8030). The honest capability table
changed as a result — for the better:

| Capability | As a PWA | As a native app |
|---|---|---|
| Reminder at 06:45 with the app fully closed | ❌ Impossible without a server | ✅ OS-scheduled, no server |
| "You have arrived at work" with the app closed | ❌ Spec-forbidden | ✅ OS region monitoring |
| Works with no internet | ✅ | ✅ |
| Nothing leaves the device | ✅ | ✅ |
| Installable from a browser link | ✅ | ❌ store/APK instead |

The honesty requirements (#34, #36) still hold and are enforced by `CapabilityBadge`, which
reads the *real* permission state at runtime and never claims more than the phone will do.

| 57 | **Choose a location from a list and see it on a map** | msg 22 | done — geocoder search returns a tappable list; every candidate is plotted on the map so same-named places can be told apart |
| 58 | **Build a shareable APK** | msg 23 | done — `./scripts/build-apk.sh`, signed with a real key, built locally with no Expo account |

## Note on requirement #49

"No map-tile dependency" was my own derivation from the offline rule, not something the user
asked for. When they later asked for map input it was added as an *additional* path — GPS
remains the default and the only one that works with no network, so the offline guarantee is
intact and the map is a pure enhancement.


---

# Session 2 — the reminder rebuild

| # | Requirement | Status |
|---|-------------|--------|
| 59 | Choose a location from a **list** of results and see it **on a map** | done — list of candidates, all plotted as pins, chosen one ticked |
| 60 | Build a **shareable APK** | done — `./scripts/build-apk.sh`, signed locally, 61 MB |
| 61 | Restructure around **reminders**, not my data model | done — tabs are Today · Reminders · Places · More |
| 62 | Reminder with **many times and many places** | done — a Reminder compiles to one automation per time × lead × place |
| 63 | **Custom lead time** ("23 minutes before leaving for temple") | done — preset chips plus any value, several at once |
| 64 | **Uber-style address entry** for places | done — search first, address stored and shown, Home/Work slots |
| 65 | **Alarm as well as notification** | done — own Android channel, MAX importance, alarm audio, bypasses DND |
| 66 | **Both** alarm and message selectable together | done — early warnings stay quiet, the one at the real moment rings |
| 67 | **Frequency with an end** ("3× a day for 1 week") | done — bounded courses schedule dated occurrences and expire on their own |
| 68 | **Wake me N minutes before reaching** a place | done — an approach circle, not a time offset; 6 min at metro speed = 4.5 km |
| 69 | **Auto-detect travel speed**, don't ask walk/car/metro | done — learned from GPS per place, rolling average, middling default |
| 70 | Today must show **reminders**, not the packing list | done — and fixed the cause: daily-reset lists were showing unconditionally |
| 71 | Place search must find **"sikanderpur"** | done — OpenStreetMap search, biased to current position |
| 72 | Drop **"On the way"** | done — a place-triggered reminder does the same job with nothing to press |
| 73 | A **visible** button to add a place | done — the header plus had no word, breaking the app's own icon rule |
| 74 | Real **time picker**, any minute (9:02, not 15-min chips) | done — the OS picker, with round-time shortcuts above it |
| 75 | **Sticky save button** with validation, not a Done at the top | done — `SaveBar` says what is missing rather than greying out silently |
| 76 | **Edit a reminder's time** | done — the row opens the picker; before, you had to delete and re-add |

## Bugs found and fixed in this session

| What | Why it happened |
|------|-----------------|
| Crash on every screen in Expo Go | `expo-notifications` throws on IMPORT there; I guarded usage, not import |
| Crash in Commute and History | `Intl.RelativeTimeFormat` is undefined on Hermes |
| Today was a wall of packing lists | lists showed if they reset daily, regardless of relevance |
| APK was 108 MB | `ndk.abiFilters` is not the lever; React Native uses `reactNativeArchitectures` |
| Release APK nearly shipped debug-signed | my own config plugin's regex assigned the keys backwards |
| Primary button failed WCAG AA | the test checked the solid accent; the button is painted with the gradient |

## The privacy claim changed, deliberately

Adding place search made DailyFlow issue its first network request. The app used to say
"nothing is ever sent to the internet". That would have become a lie, so it now says exactly
what is sent (the words you type), when (only while searching), and what is not (everything
else) — on the search field itself, not buried in settings.


---

# Release readiness (session 3)

| # | Requirement | Status |
|---|-------------|--------|
| 77 | **Must work fully on iOS too**, not only Android | auditing — see note below |
| 78 | **Alarm must cover the screen and ring for a set duration** | Android: native module to build. **iOS: not permitted by Apple** |
| 79 | **Thorough testing of everything before customers see it** | adversarial QA sweep running |
| 80 | Tell the user only when tested and the APK is ready — **GTM ready** | pending |
| 81 | **No API keys, no credit card** — free services only | done — OpenStreetMap for both search and map tiles; expo-maps removed |
| 82 | A way to see whether reminders are **actually scheduled** | done — "What is set" reads the pending list back out of the OS |

## The alarm, stated honestly

What DailyFlow can schedule by itself is a notification. On Android it is a maximum-importance
one on the alarm audio channel — loud, strong vibration — but it sounds once and waits. It does
not ring until dismissed.

A true full-screen ringing alarm needs a full-screen intent, a looping player and a foreground
service. `expo-notifications` exposes none of those (verified: no `fullScreenIntent` anywhere in
its type definitions), so it requires native Android code.

**On iOS it is not a matter of effort — Apple does not permit it.** No third-party app can take
over the screen and ring; only Apple's Clock can. The best available is a Time Sensitive
notification, and `critical` interruption level needs an entitlement granted by Apple on
application. There is also no public API to create an alarm in the iOS Clock app, so the Android
handoff has no iOS equivalent.

Decision: ship the Clock handoff now (a real ringing alarm, today, at no cost), then build the
native Android module. iOS gets the strongest notification Apple allows, and the app says so
rather than implying otherwise.


---

# Pre-release QA (session 3)

Two adversarial audits ran against the code: a five-dimension QA sweep (crashes, data loss,
silent failures, logic, UX) with every finding verified by a separate skeptic, and an iOS
compatibility audit. **17 defects confirmed, 7 refuted.** All 17 fixed, plus one I introduced
while fixing another.

## The ones that would have reached customers

| Defect | Consequence |
|---|---|
| Soft-delete tombstone written to the column, not the document | Every reminder, place and list the user ever deleted **came back to life** when they restored a backup |
| "Open a saved copy" had no confirmation | One tap on a mild-sounding row **irreversibly destroyed everything**; a bad file left it half-wiped with no message |
| Notification budget truncated in the wrong order | "3× a day for a month" **silently lost an entire dose per day** |
| Lead time crossing midnight kept the original day | A 30-minute warning on a 00:10 Monday reminder was scheduled for **Monday 23:40** — nearly a day late |
| Quiet hours never applied to clock reminders | The setting said "DailyFlow stays quiet" and it **rang at 3am** |
| Firing ledger recorded delivery before attempting it | A failed delivery was marked delivered, so that reminder **could never fire again** |
| Deleting a place orphaned its reminders | They stayed enabled, looked fine, and **could never fire** |
| One geofence region per place | "When I arrive at the office" fired **4.5 km early** because another reminder wanted a warning |
| Alarm style discarded on iOS, explanation Android-gated | iPhone users got the **weakest behaviour and the least warning** |

## A regression I caused, and what it taught

Fixing "quiet hours don't work", I made them filter firings out of the schedule. Quiet hours
default to on, 22:00–07:00 — so **"leave for work at 06:45" and the time picker's own "Early
06:00" shortcut were silently never scheduled**, while still showing a green "works even when
closed" badge. I replaced a setting that lied with reminders that vanish: the same failure
class, one level worse.

The design was wrong, not just the code. A reminder deliberately set for 06:45 is one the user
*wants* at 06:45. Quiet hours now suppress only the app's own incidental nudges, and the
editor warns where the user can act on it.

**Every fix has a test.** 264 passing.
