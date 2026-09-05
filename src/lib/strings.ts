/**
 * Every user-facing word in DailyFlow lives here.
 *
 * Two reasons, both hard requirements:
 *  1. Low-literacy usability (REQUIREMENTS.md #17). The vocabulary below is deliberate and is
 *     grounded in W3C COGA "Making Content Usable", ISO 24495-1 plain language (~CEFR B1),
 *     NN/g's icon-ambiguity findings and ICT4D text-free UI research. Sentences stay at or
 *     under ~12 words, active voice, present tense, one idea each, no metaphors, no double
 *     negatives. One word means one thing everywhere.
 *  2. Translation later needs no rewrite — swapping this object is the whole job.
 *
 * The jargon on the left of each comment is what we must NEVER show:
 *   automation → Reminder      trigger → When         condition → Only if
 *   action → Then              routine → Day plan     checklist → List
 *   geofence → Place           radius → How close     commute → On the way
 *   notification → Reminder    permission → Allow     snooze → Later
 *   priority → How important   quiet hours → Do not wake me
 *   export → Save a copy       import → Open a saved copy
 *   storage → Space used       reset → Remove everything
 */

export const S = {
  appName: 'DailyFlow',

  // ── Navigation ──────────────────────────────────────────────────────────
  nav: {
    today: 'Today',
    places: 'Places',
    dayPlans: 'Day plans',
    lists: 'Lists',
    more: 'More',
  },

  // ── Universal actions ───────────────────────────────────────────────────
  action: {
    done: 'Done',
    goBack: 'Go back',
    add: 'Add',
    change: 'Change',
    remove: 'Remove',
    undo: 'Undo',
    makeCopy: 'Make a copy',
    tryAgain: 'Try again',
    next: 'Next',
    skip: 'Skip',
    listen: 'Listen',
    sayIt: 'Say the name',
    useMyLocation: 'I am here now',
    notNow: 'Not now',
    allow: 'Allow',
    turnOn: 'Turn on',
    turnOff: 'Turn off',
    on: 'On',
    off: 'Off',
    seeAll: 'See all',
    find: 'Find',
  },

  // ── Today ───────────────────────────────────────────────────────────────
  today: {
    goodMorning: 'Good morning',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    goodNight: 'Good night',
    next: 'Next',
    now: 'Now',
    later: 'Later',
    nothingNext: 'Nothing planned next',
    freeDay: 'Today is free',
    freeDayHelp: 'Nothing is planned. Enjoy your day.',
    takeWithYou: 'Take with you',
    allPacked: 'You have everything',
    missedTitle: 'While you were away',
    missedOne: (n: number) => (n === 1 ? '1 reminder was missed' : `${n} reminders were missed`),
    startDay: 'Start my day',
    quickAdd: 'Add something',
  },

  // ── Places ──────────────────────────────────────────────────────────────
  place: {
    title: 'Places',
    help: 'Places you go often. DailyFlow can remind you when you arrive or leave.',
    addOne: 'Add a place',
    empty: 'No places yet',
    emptyHelp: 'Add the places you go often, like home or work.',
    whereAreYou: 'Where is this place?',
    hereNow: 'I am here now',
    gotLocation: 'Got it. This spot is saved.',
    noLocation: 'DailyFlow could not find where you are.',
    howClose: 'How close do you need to be?',
    howCloseHelp: 'DailyFlow tells you when you come in or go out of this ring.',
    closeExact: 'Right here',
    closeExactHelp: 'Just this spot',
    closeBuilding: 'This building',
    closeBuildingHelp: 'Good for home and work',
    closeStreet: 'This street',
    closeStreetHelp: 'Good for a big place',
    closeArea: 'This whole area',
    closeAreaHelp: 'Good for a village or a large campus',
    whenIArrive: 'When I get here',
    whenILeave: 'When I go away',
    nameIt: 'What do you call this place?',
  },

  // ── Day plans (routines) ────────────────────────────────────────────────
  plan: {
    title: 'Day plans',
    help: 'The things you do again and again.',
    addOne: 'Add a day plan',
    empty: 'No day plans yet',
    emptyHelp: 'A day plan is something you do often, like going to work.',
    whichDays: 'Which days?',
    whatTime: 'What time?',
    fromWhere: 'You start from',
    toWhere: 'You go to',
    howYouGo: 'How do you go?',
    takeWith: 'What do you take?',
    tellMe: 'When should DailyFlow tell you?',
    everyDay: 'Every day',
    workDays: 'Work days',
    weekend: 'Weekend',
    someDays: 'Some days',
  },

  // ── Lists (checklists) ──────────────────────────────────────────────────
  list: {
    title: 'Lists',
    help: 'Things to take or things to do. Use a list again and again.',
    addOne: 'Add a list',
    empty: 'No lists yet',
    emptyHelp: 'Make a list of things you take with you.',
    addThing: 'Add a thing',
    things: 'Things',
    nice: 'Nice to have',
    niceHelp: 'DailyFlow will not worry if you forget this.',
    mustHave: 'Must not forget',
    clearsDaily: 'Empties every day',
    clearsOnPlan: 'Empties when the day plan starts',
    clearsManual: 'You empty it yourself',
    clearsNever: 'Stays as it is',
    whenEmpty: 'When should the ticks clear?',
  },

  // ── Reminders (automations) ─────────────────────────────────────────────
  reminder: {
    title: 'Reminders',
    help: 'DailyFlow can tell you things at the right moment.',
    addOne: 'Add a reminder',
    when: 'When',
    onlyIf: 'Only if',
    then: 'Then',
    empty: 'No reminders yet',
    emptyHelp: 'Tell DailyFlow when to remind you.',
    // Sentence-builder prompts, one question per screen.
    pickWhen: 'When should this happen?',
    pickOnlyIf: 'Should this happen every time?',
    pickThen: 'What should DailyFlow do?',
    everyTime: 'Yes, every time',
    onlySometimes: 'Only sometimes',
    // Snooze — never shows minutes.
    later: 'Later',
    laterBit: 'A bit later',
    laterTonight: 'Tonight',
    laterTomorrow: 'Tomorrow',
    notAgainToday: 'Not again today',
    // How important — three physical sizes, no numbers.
    howImportant: 'How important is this?',
    quiet: 'Quiet',
    quietHelp: 'No sound. It waits on the Today screen.',
    normal: 'Normal',
    normalHelp: 'A sound and a message.',
    important: 'Important',
    importantHelp: 'It will reach you, even when you asked not to be woken.',
  },

  // ── On the way (commute) ────────────────────────────────────────────────
  way: {
    title: 'On the way',
    started: 'On the way',
    startedHelp: 'Have a good trip.',
    almostThere: 'Almost there',
    arrived: 'You have arrived',
    startIt: 'I am leaving now',
    endIt: 'I have arrived',
    howLong: 'How long does it usually take?',
    walk: 'Walk',
    cycle: 'Cycle',
    car: 'Car',
    bus: 'Bus',
    metro: 'Metro',
    train: 'Train',
    other: 'Other way',
  },

  // ── Honesty badges: what this phone can actually do ──────────────────────
  can: {
    closed: 'Works even when DailyFlow is closed',
    openOnly: 'Only works while DailyFlow is open',
    needsAllow: 'Needs your permission first',
    off: 'Turned off',
    whyOpenOnly: 'Your phone will not let DailyFlow watch this in the background.',
    fixIt: 'Turn it on',
  },

  // ── Permissions, asked only in context and never on first launch ─────────
  allow: {
    remindersTitle: 'Can DailyFlow send you reminders?',
    remindersBody: 'DailyFlow needs your permission to show a reminder at the right time. It only sends what you ask for.',
    remindersYes: 'Yes, send reminders',
    placesTitle: 'Can DailyFlow see where you are?',
    placesBody: 'DailyFlow checks if you are near your places, so it can remind you when you arrive or leave. Where you are stays on this phone. It is never sent anywhere.',
    placesYes: 'Yes, use where I am',
    placesAlwaysTitle: 'Even when DailyFlow is closed?',
    placesAlwaysBody: 'To tell you when you arrive, DailyFlow needs to check your place even when it is closed. It still stays on this phone.',
    blockedTitle: 'This is turned off',
    blockedBody: 'You said no earlier. That is fine. You can turn it on in your phone settings whenever you want.',
    openSettings: 'Open phone settings',
  },

  // ── Settings ────────────────────────────────────────────────────────────
  settings: {
    title: 'Settings',
    look: 'How it looks',
    theme: 'Light or dark',
    themeSystem: 'Same as my phone',
    themeLight: 'Light',
    themeDark: 'Dark',
    biggerText: 'Bigger text',
    sound: 'Sound and shaking',
    vibrate: 'Shake the phone',
    doNotWake: 'Do not wake me',
    doNotWakeHelp: 'DailyFlow stays quiet between these times.',
    tooMany: 'How many reminders in one day is too many?',
    tooManyHelp: (n: number) => `DailyFlow will never send more than ${n} in a day. The most important come first.`,
    yourData: 'Your things',
    saveCopy: 'Save a copy',
    saveCopyHelp: 'Keep all your things in one file, so you can put them on a new phone.',
    openCopy: 'Open a saved copy',
    openCopyHelp: 'Bring back your things from a saved file.',
    spaceUsed: 'Space used',
    spaceUsedHelp: 'How much room DailyFlow takes on this phone.',
    whatHappened: 'What happened',
    whatHappenedHelp: 'The last things DailyFlow did.',
    removeEverything: 'Remove everything',
    removeEverythingHelp: 'This empties DailyFlow completely. It cannot be undone.',
    removeHold: 'Press and hold to remove everything',
    privacy: 'What DailyFlow knows about you',
    privacyBody:
      'Everything you put in DailyFlow stays on this phone. There is no account. Nothing is sent to the internet. DailyFlow does not work with any company. If you remove the app, everything goes with it.',
    worksOffline: 'Works without internet',
  },

  // ── Errors, always plain and never blaming the user ─────────────────────
  error: {
    generic: 'Something went wrong',
    genericHelp: 'Nothing was lost. Please try again.',
    saveFailed: 'DailyFlow could not save that',
    fileNotOurs: 'This file is not from DailyFlow',
    fileNotOursHelp: 'Choose a file you saved from DailyFlow.',
  },

  // ── First run ───────────────────────────────────────────────────────────
  welcome: {
    hello: 'This is DailyFlow',
    line1: 'It remembers your day for you.',
    line2: 'Everything stays on this phone.',
    start: 'Start',
    pickOne: 'What do you want help with first?',
    pickOneHelp: 'You can change this later.',
    later: 'I will do this later',
  },
} as const

export type Strings = typeof S
