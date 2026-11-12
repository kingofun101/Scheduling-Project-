import { describe, it, expect } from 'vitest'
import { parseAllowedPeriods, serializeAllowedPeriods, isPeriodAllowed, periodKey } from './allowedPeriods.js'

describe('parseAllowedPeriods', () => {
  it('reads "no value", junk and non-objects as no limits', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '"x"', '{}', 5]) expect(parseAllowedPeriods(raw)).toBeNull()
  })
  it('reads a per-division map, ignoring entries that are not lists', () => {
    const m = parseAllowedPeriods('{"t1":["d1|b1","d2|b4"],"t2":"oops"}')
    expect([...m.keys()]).toEqual(['t1'])
    expect([...m.get('t1')]).toEqual(['d1|b1', 'd2|b4'])
  })
  it('keeps an empty list: that division is allowed nowhere', () => {
    expect(parseAllowedPeriods('{"t1":[]}').get('t1').size).toBe(0)
  })
})

describe('serializeAllowedPeriods', () => {
  it('round-trips and sorts, and returns null when nothing is restricted', () => {
    const m = new Map([['t1', new Set(['d2|b4', 'd1|b1'])]])
    expect(serializeAllowedPeriods(m)).toBe('{"t1":["d1|b1","d2|b4"]}')
    expect(parseAllowedPeriods(serializeAllowedPeriods(m)).get('t1').has(periodKey('d1', 'b1'))).toBe(true)
    expect(serializeAllowedPeriods(new Map())).toBeNull()
    expect(serializeAllowedPeriods(null)).toBeNull()
  })
})

describe('isPeriodAllowed', () => {
  const act = { allowed_periods: '{"t1":["d1|b1","d2|b4"]}' }
  it('allows everything when the activity has no limits', () => {
    expect(isPeriodAllowed({ allowed_periods: null }, { tier_id: 't1' }, 'd9', 'b9')).toBe(true)
  })
  it('limits a listed division to its cells', () => {
    expect(isPeriodAllowed(act, { tier_id: 't1' }, 'd1', 'b1')).toBe(true)
    expect(isPeriodAllowed(act, { tier_id: 't1' }, 'd2', 'b4')).toBe(true)
    expect(isPeriodAllowed(act, { tier_id: 't1' }, 'd1', 'b4')).toBe(false)
  })
  it('leaves a division with no entry unrestricted', () => {
    expect(isPeriodAllowed(act, { tier_id: 't2' }, 'd1', 'b4')).toBe(true)
  })
})
