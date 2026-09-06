import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { copyTitle, duplicateReminder } from './duplicateReminder.ts'
import type { Reminder, Weekday } from './types.ts'

function reminder(over: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1', title: 'Morning pills', icon: 'pills', enabled: true,
    times: ['08:00'], days: [1, 2, 3] as Weekday[],
    placeTriggers: [{ id: 'pt1', placeId: 'home', on: 'leave' }],
    leadMinutes: [0, 10], checklistId: 'list1',
    priority: 'normal', alertStyle: 'alarm', sound: true, vibrate: true,
    soundFile: 'abc.mp3', soundLabel: 'My song', alarmDurationSeconds: 120,
    createdAt: 1000, updatedAt: 2000, ...over,
  }
}

const ids = { reminder: 'r2', placeTriggers: ['pt2'] }

describe('duplicateReminder', () => {
  it('carries over everything the user configured', () => {
    const copy = duplicateReminder(reminder(), ids, 5000)
    assert.equal(copy.icon, 'pills')
    assert.deepEqual(copy.times, ['08:00'])
    assert.deepEqual(copy.days, [1, 2, 3])
    assert.deepEqual(copy.leadMinutes, [0, 10])
    assert.equal(copy.alertStyle, 'alarm')
    assert.equal(copy.soundFile, 'abc.mp3')
    assert.equal(copy.alarmDurationSeconds, 120)
  })

  it('gives the copy its own id', () => {
    assert.equal(duplicateReminder(reminder(), ids, 5000).id, 'r2')
  })

  it('gives every place trigger a NEW id', () => {
    // Sharing them would not be a copy but two references to one thing: editing the place on
    // either reminder would silently change the other.
    const copy = duplicateReminder(reminder(), ids, 5000)
    assert.equal(copy.placeTriggers[0]?.id, 'pt2')
    assert.notEqual(copy.placeTriggers[0]?.id, 'pt1')
    assert.equal(copy.placeTriggers[0]?.placeId, 'home')
  })

  it('shares no array with the original', () => {
    const source = reminder()
    const copy = duplicateReminder(source, ids, 5000)
    copy.times.push('21:00')
    copy.days.push(6 as Weekday)
    copy.leadMinutes.push(30)
    assert.deepEqual(source.times, ['08:00'], 'the original must not change')
    assert.deepEqual(source.days, [1, 2, 3])
    assert.deepEqual(source.leadMinutes, [0, 10])
  })

  it('shares the checklist rather than forking it', () => {
    // A list is maintained in one place. Duplicating a reminder must not quietly create a
    // second copy of what goes in the bag, to drift apart from the first.
    assert.equal(duplicateReminder(reminder(), ids, 5000).checklistId, 'list1')
  })

  it('stamps fresh timestamps', () => {
    const copy = duplicateReminder(reminder(), ids, 5000)
    assert.equal(copy.createdAt, 5000)
    assert.equal(copy.updatedAt, 5000)
  })

  it('never copies a tombstone', () => {
    const copy = duplicateReminder(reminder({ deletedAt: 999 }), ids, 5000)
    assert.equal(copy.deletedAt, undefined)
  })

  it('falls back to a generated trigger id when too few are supplied', () => {
    const source = reminder({
      placeTriggers: [
        { id: 'a', placeId: 'home', on: 'leave' },
        { id: 'b', placeId: 'work', on: 'arrive' },
      ],
    })
    const copy = duplicateReminder(source, { reminder: 'r2', placeTriggers: ['pt2'] }, 5000)
    assert.equal(copy.placeTriggers[1]?.id, 'r2-p1')
    assert.notEqual(copy.placeTriggers[1]?.id, 'b')
  })
})

describe('copyTitle', () => {
  it('marks a copy so the two are tellable apart in a list', () => {
    assert.equal(copyTitle('Morning pills'), 'Morning pills (copy)')
  })

  it('counts instead of stacking the word', () => {
    // "Thing (copy) (copy) (copy)" is how a list becomes unreadable.
    assert.equal(copyTitle('Morning pills (copy)'), 'Morning pills (copy 2)')
    assert.equal(copyTitle('Morning pills (copy 2)'), 'Morning pills (copy 3)')
    assert.equal(copyTitle('Morning pills (copy 9)'), 'Morning pills (copy 10)')
  })

  it('is case insensitive about an existing marker', () => {
    assert.equal(copyTitle('Pills (Copy)'), 'Pills (copy 2)')
  })

  it('handles an empty title without producing a nameless row', () => {
    assert.equal(copyTitle('   '), 'Reminder (copy)')
  })

  it('does not mistake ordinary brackets for a copy marker', () => {
    assert.equal(copyTitle('Pills (after food)'), 'Pills (after food) (copy)')
  })
})
