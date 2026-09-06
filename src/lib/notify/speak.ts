import * as Speech from 'expo-speech'

/**
 * Reading things aloud.
 *
 * This is the most useful accessibility feature in the app for the audience it was built for.
 * Someone who reads slowly, or not at all, can HEAR the reminder — "take your medicine" spoken
 * is understood by people for whom the same words on screen are work. It is also simply
 * convenient while driving, cooking or half-asleep.
 *
 * It runs on the operating system's own speech engine: no network, no API key, no account, and
 * nothing leaves the device — the text is spoken by the phone itself.
 *
 * HONEST LIMIT, and it is enforced rather than glossed over: speech needs the app to be
 * running. A notification that arrives while DailyFlow is closed is delivered by the OS, and
 * our JavaScript is not alive to speak anything. So a reminder is spoken when the app is open,
 * or when the user taps the notification — and the UI says so instead of promising a voice
 * that will not come.
 */

export interface SpeakOptions {
  /** BCP-47 tag, e.g. 'en-IN'. Falls back to the device's own voice when absent. */
  language?: string
  /** 0.1 slowest to 2.0 fastest. Slightly under 1 is easier to follow. */
  rate?: number
  pitch?: number
}

const DEFAULTS: Required<Pick<SpeakOptions, 'rate' | 'pitch'>> = {
  // Deliberately a little slower than the default: this exists for people who need the words
  // to land, and a rushed voice defeats the entire purpose.
  rate: 0.92,
  pitch: 1.0,
}

/** Speak some text. Never throws: a silent failure to speak must not break a screen. */
export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return
  try {
    // Stop anything already speaking, so two reminders never talk over each other.
    await stopSpeaking()
    Speech.speak(trimmed, {
      language: options.language,
      rate: options.rate ?? DEFAULTS.rate,
      pitch: options.pitch ?? DEFAULTS.pitch,
    })
  } catch {
    // No speech engine, or the OS refused. The text is still on screen.
  }
}

export async function stopSpeaking(): Promise<void> {
  try {
    if (await Speech.isSpeakingAsync()) Speech.stop()
  } catch {
    // Nothing was speaking, or the engine is unavailable.
  }
}

export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync()
  } catch {
    return false
  }
}

/** Whether this device can speak at all, so the UI never offers a button that does nothing. */
export async function speechAvailable(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync()
    return voices.length > 0
  } catch {
    // Android often reports no voices until the engine warms up; assume it can and let the
    // attempt fail quietly rather than hiding the feature from someone who needs it most.
    return true
  }
}

/** The sentence a reminder should say out loud — title, then detail, as one utterance. */
export function reminderSpeech(title: string, body?: string): string {
  return body ? `${title}. ${body}` : title
}
