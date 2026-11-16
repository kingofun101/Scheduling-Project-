import { describe, it, expect } from 'vitest'
import { spreadRule, spreadFindings } from './spread.js'

describe('spreadRule', () => {
  it('needs both a family name and a positive limit', () => {
    expect(spreadRule({ spread_group: 'Sports', spread_max_per_day: 2 })).toEqual({ key: 'sports', label: 'Sports', max: 2 })
    expect(spreadRule({ spread_group: '  ', spread_max_per_day: 2 })).toBeNull()
    expect(spreadRule({ spread_group: 'Sports', spread_max_per_day: 0 })).toBeNull()
    expect(spreadRule({ spread_group: 'Sports', spread_max_per_day: null })).toBeNull()
    expect(spreadRule({})).toBeNull()
  })
  it('treats family names case-insensitively', () => {
    expect(spreadRule({ spread_group: 'WATER', spread_max_per_day: 1 }).key).toBe(spreadRule({ spread_group: 'water', spread_max_per_day: 1 }).key)
  })
})

describe('spreadFindings', () => {
  const groups = [{ id: 'g1', name: 'Geza 1' }]
  const days = [{ id: 'd1', label: 'Monday' }, { id: 'd2', label: 'Tuesday' }]
  const activities = [
    { id: 'a', name: 'Soccer', spread_group: 'Sports', spread_max_per_day: 2 },
    { id: 'b', name: 'Hockey', spread_group: 'sports', spread_max_per_day: 2 },
    { id: 'c', name: 'Tennis', spread_group: 'Sports', spread_max_per_day: 2 },
    { id: 'd', name: 'Arts' },
  ]
  const slot = (dayId, activityId) => ({ groupId: 'g1', dayId, activityId, type: 'activity' })

  it('reports a day that goes over the limit, once, naming the activity that tipped it', () => {
    const f = spreadFindings({ slots: [slot('d1', 'a'), slot('d1', 'b'), slot('d1', 'c'), slot('d2', 'a'), slot('d2', 'd')], groups, activities, days })
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ kind: 'SPREAD', groupId: 'g1', activityId: 'c', severity: 'caution' })
    expect(f[0].reason).toContain('Monday')
    expect(f[0].reason).toContain('3 on')
  })
  it('reports nothing at or under the limit, and nothing without rules', () => {
    expect(spreadFindings({ slots: [slot('d1', 'a'), slot('d1', 'b')], groups, activities, days })).toEqual([])
    expect(spreadFindings({ slots: [slot('d1', 'a')], groups, activities: [{ id: 'a', name: 'Soccer' }], days })).toEqual([])
  })
  it('reads stored rows (snake_case) and skips fixed events and span tails', () => {
    const rows = [
      { group_id: 'g1', day_id: 'd1', activity_id: 'a' },
      { group_id: 'g1', day_id: 'd1', activity_id: 'b' },
      { group_id: 'g1', day_id: 'd1', activity_id: 'c', is_span_head: 0 },
      { group_id: 'g1', day_id: 'd1', activity_id: 'c', is_fixed_event: 1 },
    ]
    expect(spreadFindings({ slots: rows, groups, activities, days })).toEqual([])
  })
})
