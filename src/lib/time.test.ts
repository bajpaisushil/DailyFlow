import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  describeDays, isWithinWindow, localDateKey, minutesOfDay,
  formatTime, humanDelta, parseHHMM, timestampForTimeOn, toHHMM, weekdayName,
} from './time.ts'

describe('parseHHMM', () => {
  it('parses valid times to minutes since midnight', () => {
    assert.equal(parseHHMM('00:00'), 0)
    assert.equal(parseHHMM('06:45'), 405)
    assert.equal(parseHHMM('23:59'), 1439)
  })

  it('rejects out-of-range and malformed values rather than coercing them', () => {
    assert.equal(parseHHMM('24:00'), null)
    assert.equal(parseHHMM('12:60'), null)
    assert.equal(parseHHMM('nonsense'), null)
    assert.equal(parseHHMM(''), null)
  })
})

describe('toHHMM', () => {
  it('round-trips with parseHHMM', () => {
    for (const t of ['00:00', '06:45', '13:07', '23:59']) {
      assert.equal(toHHMM(parseHHMM(t)!), t)
    }
  })

  it('wraps past midnight, which "15 minutes before 00:05" depends on', () => {
    assert.equal(toHHMM(-15), '23:45')
    assert.equal(toHHMM(1440), '00:00')
    assert.equal(toHHMM(1455), '00:15')
  })
})

describe('isWithinWindow', () => {
  it('handles an ordinary daytime window, end-exclusive', () => {
    assert.equal(isWithinWindow(600, '09:00', '17:00'), true)
    assert.equal(isWithinWindow(1020, '09:00', '17:00'), false)
    assert.equal(isWithinWindow(480, '09:00', '17:00'), false)
  })

  it('handles quiet hours that wrap past midnight', () => {
    // 22:00 -> 07:00 is the default "do not wake me" window.
    assert.equal(isWithinWindow(1350, '22:00', '07:00'), true)  // 22:30
    assert.equal(isWithinWindow(60, '22:00', '07:00'), true)    // 01:00
    assert.equal(isWithinWindow(420, '22:00', '07:00'), false)  // 07:00 exclusive
    assert.equal(isWithinWindow(720, '22:00', '07:00'), false)  // midday
  })

  it('treats an empty window as never matching', () => {
    assert.equal(isWithinWindow(600, '10:00', '10:00'), false)
  })
})

describe('timestampForTimeOn', () => {
  it('anchors a wall-clock time to the local day of the reference date', () => {
    const ref = new Date(2026, 8, 5, 18, 30)
    const at = timestampForTimeOn(ref, '06:45')
    assert.ok(at !== null)
    const d = new Date(at)
    assert.equal(d.getFullYear(), 2026)
    assert.equal(d.getMonth(), 8)
    assert.equal(d.getDate(), 5)
    assert.equal(d.getHours(), 6)
    assert.equal(d.getMinutes(), 45)
  })
})

describe('localDateKey', () => {
  it('uses the local calendar date, not UTC', () => {
    // Late-evening local time must not roll forward to tomorrow's key.
    assert.equal(localDateKey(new Date(2026, 0, 15, 23, 30)), '2026-01-15')
    assert.equal(localDateKey(new Date(2026, 0, 1, 0, 5)), '2026-01-01')
  })
})

describe('minutesOfDay', () => {
  it('reads the local wall clock', () => {
    assert.equal(minutesOfDay(new Date(2026, 0, 1, 6, 45)), 405)
  })
})

describe('describeDays', () => {
  it('names the common sets in plain words rather than listing them', () => {
    assert.equal(describeDays([0, 1, 2, 3, 4, 5, 6]), 'Every day')
    assert.equal(describeDays([1, 2, 3, 4, 5]), 'Weekdays')
    assert.equal(describeDays([0, 6]), 'Weekends')
  })

  it('falls back to short day names for an arbitrary set', () => {
    const result = describeDays([1, 3, 5])
    assert.ok(result.includes('Mon'))
    assert.ok(result.includes('Wed'))
    assert.ok(result.includes('Fri'))
  })
})

describe('humanDelta', () => {
  const now = 1_700_000_000_000

  it('says "just now" rather than "0 minutes ago"', () => {
    assert.equal(humanDelta(now, now), 'just now')
    assert.equal(humanDelta(now, now + 20_000), 'just now')
  })

  it('reads naturally in both directions', () => {
    assert.equal(humanDelta(now, now - 60_000), '1 minute ago')
    assert.equal(humanDelta(now, now - 600_000), '10 minutes ago')
    assert.equal(humanDelta(now, now + 600_000), 'in 10 minutes')
  })

  it('rolls up to hours and days', () => {
    assert.equal(humanDelta(now, now - 3_600_000), '1 hour ago')
    assert.equal(humanDelta(now, now - 7_200_000), '2 hours ago')
    assert.equal(humanDelta(now, now - 86_400_000), '1 day ago')
    assert.equal(humanDelta(now, now + 172_800_000), 'in 2 days')
  })

  it('never throws when Intl is thin, because it does not use Intl at all', () => {
    // Intl.RelativeTimeFormat is undefined on Android Hermes and crashed two screens.
    assert.doesNotThrow(() => humanDelta(now, now - 500_000))
  })
})

describe('formatTime', () => {
  it('formats both clock styles', () => {
    assert.ok(formatTime('06:45', true).includes('06:45'))
    const twelve = formatTime('18:30', false)
    assert.ok(twelve.includes('6:30'), twelve)
  })

  it('returns the input unchanged rather than throwing on nonsense', () => {
    assert.equal(formatTime('99:99', false), '99:99')
  })
})

describe('weekdayName', () => {
  it('gives a letter, a short name and a full name', () => {
    assert.equal(weekdayName(1, 'long'), 'Monday')
    assert.equal(weekdayName(1, 'short').slice(0, 3), 'Mon')
    assert.equal(weekdayName(1, 'narrow').length, 1)
  })
})
