/**
 * DailyFlow — core domain model.
 *
 * Design rules that this file encodes:
 *  1. A Routine is *sugar*: it COMPILES into Automations (see lib/engine/compile.ts). The engine only
 *     ever evaluates Automations, so there is a single evaluation path, a single firing ledger and a
 *     single notification-governance pipeline. Beginners edit Routines; advanced users can detach a
 *     Routine and edit the generated Automations directly. That is our progressive disclosure.
 *  2. Conditions are a FLAT list joined by one combinator (`all` | `any`), with per-condition `negate`.
 *     Arbitrary nested boolean trees are deliberately not supported: they cover a few extra percent of
 *     cases at the cost of turning the builder into a developer tool (REQUIREMENTS.md #17).
 *  3. Trigger/Condition/Action are open-ended `kind` + typed `params` pairs backed by a registry, so a
 *     new capability is one registry entry and the builder UI picks it up with no UI changes (#25).
 */

/** Stable identifier. `crypto.randomUUID()` everywhere. */
export type Id = string

/** Epoch milliseconds. */
export type Timestamp = number

/** Local wall-clock time, 24h, zero-padded. e.g. "06:45". Never a Date — these are recurring. */
export type HHMM = string

/** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** A calendar day in the user's local zone, "YYYY-MM-DD". Used as the reset key for checklist runs. */
export type LocalDate = string

// ────────────────────────────────────────────────────────────────────────────
// Shared record shape
// ────────────────────────────────────────────────────────────────────────────

export interface BaseRecord {
  id: Id
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Soft delete: keeps history and export round-trips honest. Filtered from every list query. */
  deletedAt?: Timestamp
}

// ────────────────────────────────────────────────────────────────────────────
// Places
// ────────────────────────────────────────────────────────────────────────────

export interface Place extends BaseRecord {
  name: string
  /** Icon key from lib/icons.ts — never a raw emoji, so it stays themeable and translatable. */
  icon: string
  lat: number
  lon: number
  /**
   * Geofence radius in metres. Never shown to the user as a number — the picker offers
   * "right here / this building / this street / this area" and maps to these values.
   */
  radiusM: number
  /** Free-text note the user can attach. Optional; most users never fill it. */
  note?: string
  /** Checklists surfaced when arriving here. */
  checklistIds: Id[]
  /** Show this place on the Today screen's context strip. */
  pinned?: boolean
  colorKey?: string
}

/** Coarse radius presets. The UI shows pictures and words; the metres stay internal. */
export const RADIUS_PRESETS = [
  { key: 'exact', metres: 75 },
  { key: 'building', metres: 150 },
  { key: 'street', metres: 300 },
  { key: 'area', metres: 600 },
] as const
export type RadiusPresetKey = (typeof RADIUS_PRESETS)[number]['key']

// ────────────────────────────────────────────────────────────────────────────
// Checklists
// ────────────────────────────────────────────────────────────────────────────

/**
 * When a checklist's ticks clear. Modelled explicitly rather than implied by a routine,
 * because "reset every day" and "reset each time I do this routine" are genuinely different.
 */
export type ChecklistResetRule =
  | { kind: 'daily' }
  | { kind: 'onRoutineStart' }
  | { kind: 'manual' }
  | { kind: 'never' }

export interface ChecklistItem {
  id: Id
  label: string
  icon?: string
  /** Optional items never block "checklist complete" and never trigger a nag. */
  optional?: boolean
  /** Sorts to the top and is named first in reminder copy. */
  important?: boolean
  note?: string
  order: number
}

export interface Checklist extends BaseRecord {
  name: string
  icon: string
  items: ChecklistItem[]
  resetRule: ChecklistResetRule
  /** A one-off list (e.g. today's shopping) is hidden from the reusable-template pickers. */
  oneOff?: boolean
}

/**
 * The per-occurrence tick state, kept separate from the template. This separation is the
 * whole point: templates are stable, runs are disposable and are what actually gets pruned.
 */
export interface ChecklistRun {
  id: Id
  checklistId: Id
  /** The reset bucket this run belongs to — usually the local date. */
  periodKey: string
  checkedItemIds: Id[]
  startedAt: Timestamp
  completedAt?: Timestamp
  /** Set when the user chose "skip today" so nagging stops without faking completion. */
  dismissedAt?: Timestamp
}

// ────────────────────────────────────────────────────────────────────────────
// Triggers / Conditions / Actions
// ────────────────────────────────────────────────────────────────────────────

export interface TriggerParamMap {
  'time.at': { time: HHMM }
  'time.beforeRoutine': { routineId: Id; minutesBefore: number }
  'place.enter': { placeId: Id }
  'place.exit': { placeId: Id }
  'place.dwell': { placeId: Id; minutes: number }
  'routine.start': { routineId: Id }
  'routine.end': { routineId: Id }
  'checklist.unfinished': { checklistId: Id; atTime: HHMM }
  'battery.below': { percent: number }
  'app.opened': Record<string, never>
  'day.started': Record<string, never>
  'mode.on': { mode: string }
  'mode.off': { mode: string }
}
export type TriggerKind = keyof TriggerParamMap

export type Trigger = {
  [K in TriggerKind]: { kind: K; params: TriggerParamMap[K] }
}[TriggerKind]

export interface ConditionParamMap {
  'day.isOneOf': { days: Weekday[] }
  'time.between': { from: HHMM; to: HHMM }
  'place.currentlyAt': { placeId: Id }
  'checklist.isComplete': { checklistId: Id }
  'routine.isActive': { routineId: Id }
  'mode.isOn': { mode: string }
  'battery.below': { percent: number }
  'network.isOffline': Record<string, never>
}
export type ConditionKind = keyof ConditionParamMap

export type Condition = {
  [K in ConditionKind]: {
    kind: K
    params: ConditionParamMap[K]
    /** Flips the result. Rendered as "is not…" in the sentence UI. */
    negate?: boolean
  }
}[ConditionKind]

export type NotificationPriority = 'quiet' | 'normal' | 'important'

export interface ActionParamMap {
  notify: {
    title: string
    body?: string
    priority: NotificationPriority
    /** Names the checklist's unchecked items inline in the body. */
    includeChecklistId?: Id
    vibrate?: boolean
  }
  'checklist.show': { checklistId: Id }
  'checklist.reset': { checklistId: Id }
  'mode.turnOn': { mode: string }
  'mode.turnOff': { mode: string }
  'commute.start': { commuteProfileId: Id }
  'commute.end': Record<string, never>
  speak: { text: string }
  openUrl: { url: string; label?: string }
  log: { message: string }
}
export type ActionKind = keyof ActionParamMap

export type Action = {
  [K in ActionKind]: { kind: K; params: ActionParamMap[K] }
}[ActionKind]

// ────────────────────────────────────────────────────────────────────────────
// Automations
// ────────────────────────────────────────────────────────────────────────────

/** How often a single automation may fire, independent of global notification limits. */
export interface AutomationLimits {
  /** Minimum gap between two firings of this automation. */
  cooldownMinutes?: number
  /** Hard cap per calendar day. */
  maxPerDay?: number
}

export interface Automation extends BaseRecord {
  name: string
  icon?: string
  enabled: boolean
  trigger: Trigger
  /** Flat list joined by `match`. See design rule 2 at the top of this file. */
  conditions: Condition[]
  match: 'all' | 'any'
  actions: Action[]
  limits?: AutomationLimits
  /**
   * Set when this automation was generated by compiling a Routine. Such automations are
   * regenerated on routine edit and are hidden from the simple list. Clearing this field
   * ("detach") hands permanent ownership to the user.
   */
  sourceRoutineId?: Id
  /** Ordering hint within a compiled routine, so regeneration is stable. */
  sourceSlot?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Routines
// ────────────────────────────────────────────────────────────────────────────

export type TransportMode = 'walk' | 'cycle' | 'car' | 'bus' | 'metro' | 'train' | 'other'

/** Which of the friendly, pre-wired reminders a routine should generate. */
export interface RoutineReminders {
  /** "Office day today" — a calm heads-up N minutes before departure. */
  headsUpMinutes?: number
  /** "Leaving in 15 minutes. Don't forget…" */
  checklistNudgeMinutes?: number
  /** "Time to leave." */
  atDeparture?: boolean
  /** "You've left Home. Have everything?" — needs location. */
  onLeaveOrigin?: boolean
  /** "You've reached Office." — needs location. */
  onArriveDestination?: boolean
}

export interface Routine extends BaseRecord {
  name: string
  icon: string
  enabled: boolean
  days: Weekday[]
  /** When the routine's window opens. For commute routines this is the departure time. */
  startTime: HHMM
  endTime?: HHMM
  originPlaceId?: Id
  destinationPlaceId?: Id
  transport?: TransportMode
  /** User's own estimate; we never fetch a live ETA (that would need a backend). */
  typicalDurationMinutes?: number
  checklistIds: Id[]
  reminders: RoutineReminders
  colorKey?: string
  /** Once detached, the routine stops regenerating automations and becomes display-only. */
  detached?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// Commute
// ────────────────────────────────────────────────────────────────────────────

export interface CommuteProfile extends BaseRecord {
  name: string
  icon: string
  originPlaceId?: Id
  destinationPlaceId?: Id
  transport: TransportMode
  typicalDurationMinutes: number
  checklistIds: Id[]
  /** Deep links the user chose — e.g. their music app. Opened only on an explicit tap. */
  shortcuts: { id: Id; label: string; url: string; icon?: string }[]
  /** "Almost there" nudge, in minutes before the expected arrival. */
  almostThereMinutes?: number
}

export interface CommuteSession {
  id: Id
  profileId?: Id
  startedAt: Timestamp
  endedAt?: Timestamp
  originPlaceId?: Id
  destinationPlaceId?: Id
  /** User-visible note jotted during the ride; stays on device like everything else. */
  notes?: string
  arrivedAt?: Timestamp
}

// ────────────────────────────────────────────────────────────────────────────
// History
// ────────────────────────────────────────────────────────────────────────────

export type ActivityKind =
  | 'automation.fired'
  | 'automation.suppressed'
  | 'notification.shown'
  | 'checklist.completed'
  | 'place.entered'
  | 'place.exited'
  | 'routine.started'
  | 'routine.ended'
  | 'commute.started'
  | 'commute.ended'
  | 'trigger.missed'

/**
 * A capped, on-device event log. Never leaves the device, auto-pruned by count and age,
 * and clearable in one tap. It exists to power "you usually do X around now" later without
 * ever needing a server.
 */
export interface ActivityEvent {
  id: Id
  at: Timestamp
  kind: ActivityKind
  /** Human-readable, already translated at write time for simplicity. */
  summary: string
  automationId?: Id
  routineId?: Id
  placeId?: Id
  checklistId?: Id
  /** Why a firing was suppressed — surfaced in the "why didn't this remind me?" panel. */
  reason?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Firing ledger — the idempotence backbone
// ────────────────────────────────────────────────────────────────────────────

/**
 * One row per intended occurrence. The engine writes a row before acting, keyed by a
 * deterministic dedup key, so an automation fires exactly once per occurrence no matter how
 * many times the tab reloads, how many tabs are open, or how long the app was closed.
 */
export interface FiringRecord {
  /** Deterministic: `${automationId}:${occurrenceKey}`. Primary key. */
  key: string
  automationId: Id
  occurrenceKey: string
  firedAt: Timestamp
  /** 'fired' | 'suppressed' | 'missed' — a missed row still blocks a late duplicate. */
  outcome: 'fired' | 'suppressed' | 'missed'
  reason?: string
}

// ────────────────────────────────────────────────────────────────────────────
// Settings
// ────────────────────────────────────────────────────────────────────────────

export type ThemePreference = 'system' | 'light' | 'dark'
export type ExperienceLevel = 'simple' | 'advanced'

export interface QuietHours {
  enabled: boolean
  from: HHMM
  to: HHMM
  /** Even in quiet hours, let 'important' through. Off by default — calm wins. */
  allowImportant: boolean
}

export interface NotificationSettings {
  /** Mirrors Notification.permission but is our own record of whether the user opted in. */
  enabled: boolean
  quietHours: QuietHours
  /** Global anti-spam ceiling. The engine drops the lowest priority first. */
  maxPerHour: number
  maxPerDay: number
  vibrate: boolean
  /** Minutes added by the snooze button. */
  snoozeMinutes: number
  /** Suppress a reminder whose checklist is already fully ticked. */
  suppressWhenChecklistDone: boolean
}

export interface LocationSettings {
  /** The user must opt in explicitly; we never request on load. */
  enabled: boolean
  /** Foreground-only is the honest default; see lib/location/. */
  mode: 'off' | 'whileOpen'
  /** Trade accuracy for battery. 'balanced' avoids the GPS chip when it can. */
  accuracy: 'balanced' | 'high'
}

export interface AppSettings {
  id: 'singleton'
  schemaVersion: number
  theme: ThemePreference
  experience: ExperienceLevel
  locale: string
  /** 0 = Sunday, 1 = Monday. Regional default, user-overridable. */
  weekStartsOn: 0 | 1
  use24HourClock: boolean
  notifications: NotificationSettings
  location: LocationSettings
  /** Which sections show on Today, in order. */
  todaySections: string[]
  /** Active named modes, e.g. "commute", "focus". Simple string set keeps this extensible. */
  activeModes: string[]
  onboardingCompletedAt?: Timestamp
  /** Caps for the on-device event log. */
  historyMaxEvents: number
  historyMaxAgeDays: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ────────────────────────────────────────────────────────────────────────────
// Export envelope
// ────────────────────────────────────────────────────────────────────────────

export const EXPORT_FORMAT = 'dailyflow.backup'
export const EXPORT_VERSION = 1

export interface ExportEnvelope {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: Timestamp
  appVersion: string
  data: {
    settings: AppSettings | null
    places: Place[]
    checklists: Checklist[]
    checklistRuns: ChecklistRun[]
    routines: Routine[]
    automations: Automation[]
    commuteProfiles: CommuteProfile[]
    commuteSessions: CommuteSession[]
    activity: ActivityEvent[]
  }
}
