import { describe, it, expect } from 'vitest'
import buildSchedule from './buildSchedule.js'

// Across a summer a group should see the catalog before it repeats: of equal candidates, the one a group
// has had least wins. The first week (no history) is unchanged.
const act = (id, extra) => ({ id, name: id, priority: 'high', min_per_week: 0, max_per_week: 1, max_groups_per_slot: 0, same_tier_only: false, eligible_tier_ids: [], eligible_group_ids: [], prefer_before_day: null, prefer_before_day_min: null, ...extra })
const block = (i) => ({ id: `b${i}`, name: `B${i}`, start_time: `0${i}:00`, end_time: `0${i}:50`, sort_order: i, part_of_day: 'morning' })
const input = (usage, blocks = 2) => ({
  groups: [{ id: 'g1', name: 'Geza 1', tier_id: 't1', availability: 'all' }],
  tiers: [{ id: 't1', name: 'Geza' }],
  days: [{ id: 'd1', label: 'Monday', day_of_week: 1, sort_order: 0 }],
  timeBlocks: Array.from({ length: blocks }, (_, i) => block(i + 1)),
  activities: ['Archery', 'Boating', 'Drama', 'Swim', 'Soccer'].map((id) => act(id)),
  fixedEvents: [], campId: 'season', replacedDayIds: [], previousWeekUsage: usage,
})
const placed = (slots) => slots.filter((s) => s.activityId).map((s) => s.activityId)

describe('buildSchedule — season fairness (counts of earlier weeks)', () => {
  it('gives a group the activities it has had least, so the catalog is covered before repeats', () => {
    const had = ['Archery', 'Boating', 'Drama'].map((activityId) => ({ groupId: 'g1', activityId, count: 3, lastWeek: false }))
    const { slots } = buildSchedule(input(had))
    expect(placed(slots).sort()).toEqual(['Soccer', 'Swim'])
  })

  it('falls back to what it has had when nothing newer can fill the cell', () => {
    const had = ['Archery', 'Boating', 'Drama', 'Swim', 'Soccer'].map((activityId, i) => ({ groupId: 'g1', activityId, count: i + 1, lastWeek: false }))
    const { slots } = buildSchedule(input(had))
    expect(placed(slots).sort()).toEqual(['Archery', 'Boating'])   // the two it has had least (1 and 2 weeks)
  })

  it('does not change the first week (no history)', () => {
    const a = buildSchedule(input([]))
    const b = buildSchedule(input(undefined))
    expect(placed(a.slots)).toEqual(placed(b.slots))
    expect(placed(a.slots)).toHaveLength(2)
  })
})
