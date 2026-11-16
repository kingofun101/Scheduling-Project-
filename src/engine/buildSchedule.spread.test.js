import { describe, it, expect } from 'vitest'
import buildSchedule from './buildSchedule.js'

// Sports are flagged "at most 1 per day". The engine keeps to it while other activities can fill the day,
// and only breaks it when a cell has nothing else, and then reports it.
const act = (id, extra) => ({ id, name: id, priority: 'high', min_per_week: 0, max_per_week: 5, max_groups_per_slot: 0, same_tier_only: false, eligible_tier_ids: [], eligible_group_ids: [], prefer_before_day: null, prefer_before_day_min: null, ...extra })
const block = (i) => ({ id: `b${i}`, name: `B${i}`, start_time: `0${i}:00`, end_time: `0${i}:50`, sort_order: i, part_of_day: 'morning' })
const base = (activities, blocks = 4) => ({
  groups: [{ id: 'g1', name: 'Geza 1', tier_id: 't1', availability: 'all' }],
  tiers: [{ id: 't1', name: 'Geza' }],
  days: [{ id: 'd1', label: 'Monday', day_of_week: 1, sort_order: 0 }],
  timeBlocks: Array.from({ length: blocks }, (_, i) => block(i + 1)),
  activities, fixedEvents: [], campId: 'spread', replacedDayIds: [],
})
const sport = (id) => act(id, { spread_group: 'Sports', spread_max_per_day: 1, max_per_week: 1 })
const plain = (id) => act(id, { max_per_week: 1 })
const placed = (slots) => slots.filter((s) => s.activityId).map((s) => s.activityId)

describe('buildSchedule — daily spread (spread_group / spread_max_per_day)', () => {
  it('keeps to one sport a day when other activities can fill the day', () => {
    const { slots, findings } = buildSchedule(base([sport('Soccer'), sport('Hockey'), sport('Tennis'), plain('Arts'), plain('Drama'), plain('Nature')]))
    expect(slots.filter((s) => !s.activityId)).toEqual([])
    expect(placed(slots).filter((id) => ['Soccer', 'Hockey', 'Tennis'].includes(id))).toHaveLength(1)
    expect(findings.filter((f) => f.kind === 'SPREAD')).toEqual([])
  })

  it('goes over the limit only to fill an empty cell, and reports it', () => {
    const { slots, findings } = buildSchedule(base([sport('Soccer'), sport('Hockey'), sport('Tennis')], 3))
    expect(slots.filter((s) => !s.activityId)).toEqual([])
    expect(placed(slots)).toHaveLength(3)
    const spread = findings.filter((f) => f.kind === 'SPREAD')
    expect(spread).toHaveLength(1)
    expect(spread[0].reason).toContain('3 on Monday')
  })

  it('does nothing for activities with no spread rule', () => {
    const { slots, findings } = buildSchedule(base([plain('Soccer'), plain('Hockey'), plain('Tennis')], 3))
    expect(placed(slots)).toHaveLength(3)
    expect(findings.filter((f) => f.kind === 'SPREAD')).toEqual([])
  })
})
