import { describe, it } from 'node:test'
import { compileReminder } from './engine/compileReminder.ts'
import { planFor } from './notify/plan.ts'
import type { Reminder } from './types.ts'

const base: Reminder = {
  id: 'r1', createdAt: 0, updatedAt: 0,
  title: 'Birthday', icon: 'gift', enabled: true,
  times: ['09:00'], days: [], placeTriggers: [], leadMinutes: [0],
  priority: 'normal', alertStyle: 'notification',
} as unknown as Reminder

describe('repro', () => {
  it('yearly', () => {
    const r = { ...base, repeat: 'yearly' as const, onDate: '2027-03-14' }
    const autos = compileReminder(r, [])
    console.log('window =', JSON.stringify(autos[0]!.window))
    const plans = planFor(autos[0]!)
    console.log('yearly plan count =', plans.length)
    console.log('first 5 =', plans.slice(0, 5).map((p) => new Date((p.when as any).at).toString()))
    console.log('last =', plans.length ? new Date((plans[plans.length-1]!.when as any).at).toString() : 'none')
  })
  it('monthly', () => {
    const r = { ...base, repeat: 'monthly' as const, onDate: '2026-01-15' }
    const autos = compileReminder(r, [])
    console.log('monthly window =', JSON.stringify(autos[0]!.window))
    const plans = planFor(autos[0]!)
    console.log('monthly plan count =', plans.length)
    console.log('first 5 =', plans.slice(0, 5).map((p) => new Date((p.when as any).at).toDateString()))
  })
  it('once', () => {
    const r = { ...base, repeat: 'once' as const, onDate: '2026-11-08' }
    const autos = compileReminder(r, [])
    console.log('once window =', JSON.stringify(autos[0]!.window))
    const plans = planFor(autos[0]!)
    console.log('once plan count =', plans.length)
    console.log('first 3 =', plans.slice(0, 3).map((p) => new Date((p.when as any).at).toDateString()))
  })
})
