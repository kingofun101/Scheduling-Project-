import { describe, it, expect } from 'vitest'
import buildSchedule from './buildSchedule.js'

// Boating is flagged "every other week". A group that had it last week gets it again only when
// nothing else can fill the cell, and then it is reported.
const act = (id, extra) => ({ id, name: id, priority: 'high', min_per_week: 0, max_per_week: 5, max_groups_per_slot: 0, same_tier_only: false, eligible_tier_ids: [], eligible_group_ids: [], prefer_before_day: null, prefer_before_day_min: null, ...extra })
const block = (i) => ({ id: `b${i}`, name: `B${i}`, start_time: `0${i}:00`, end_time: `0${i}:50`, sort_order: i, part_of_day: 'morning' })
const base = (activities, previousWeekUsage) => ({
  groups: [{ id: 'g1', name: 'Geza 1', tier_id: 't1', availability: 'all' }, { id: 'g2', name: 'Geza 2', tier_id: 't1', availability: 'all' }],
  tiers: [{ id: 't1', name: 'Geza' }],
  days: [{ id: 'd1', label: 'Monday', day_of_week: 1, sort_order: 0 }, { id: 'd2', label: 'Tuesday', day_of_week: 2, sort_order: 1 }],
  timeBlocks: [block(1), block(2), block(3)],
  activities, fixedEvents: [], campId: 'rotation', replacedDayIds: [], previousWeekUsage,
})
const used = (slots, groupId, activityId) => slots.filter((s) => s.groupId === groupId && s.activityId === activityId).length

describe('buildSchedule — rotation (rotate_every_weeks)', () => {
  const boating = () => act('Boating', { rotate_every_weeks: 2, min_per_week: 0 })

  it('keeps a group off the flagged activity when it had it last week and others can fill the week', () => {
    const { slots, findings } = buildSchedule(base([boating(), act('Archery'), act('Drama'), act('Swim')], [{ groupId: 'g1', activityId: 'Boating' }]))
    expect(used(slots, 'g1', 'Boating')).toBe(0)
    expect(used(slots, 'g2', 'Boating')).toBeGreaterThan(0)          // g2 did not have it last week
    expect(findings.filter((f) => f.kind === 'ROTATION')).toEqual([])
    expect(slots.filter((s) => s.groupId === 'g1' && !s.activityId)).toEqual([])  // and g1's week is still full
  })

  it('places no restriction on a group with no history (first week)', () => {
    const { slots, findings } = buildSchedule(base([boating(), act('Archery'), act('Drama'), act('Swim')], []))
    expect(used(slots, 'g1', 'Boating')).toBeGreaterThan(0)
    expect(findings.filter((f) => f.kind === 'ROTATION')).toEqual([])
  })

  it('does nothing for an activity that is not flagged', () => {
    const plain = act('Boating', { rotate_every_weeks: null })
    const { slots } = buildSchedule(base([plain, act('Archery')], [{ groupId: 'g1', activityId: 'Boating' }]))
    expect(used(slots, 'g1', 'Boating')).toBeGreaterThan(0)
  })

  it('falls back to a repeat rather than an empty cell, and reports it', () => {
    // Boating is the only activity, so the strict pass fills nothing for g1; the relaxed pass does.
    const { slots, findings } = buildSchedule(base([boating()], [{ groupId: 'g1', activityId: 'Boating' }]))
    // One per day is the most a single activity can give (the existing once-a-day rule), so 2 days -> 2.
    expect(used(slots, 'g1', 'Boating')).toBe(2)
    const f = findings.filter((x) => x.kind === 'ROTATION')
    expect(f).toHaveLength(1)
    expect(f[0]).toMatchObject({ groupId: 'g1', activityId: 'Boating' })
  })

  it('is deterministic with rotation on', () => {
    const input = () => base([boating(), act('Archery'), act('Drama')], [{ groupId: 'g1', activityId: 'Boating' }])
    expect(buildSchedule(input()).slots).toEqual(buildSchedule(input()).slots)
  })
})
