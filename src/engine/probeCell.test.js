import { describe, it, expect } from 'vitest'
import buildSchedule, { probeCell } from './buildSchedule.js'

// "What fits here": probeCell asks Generate's own rule check (blockedBy) about one
// cell of the week as it stands. These pin that it agrees with Generate, never
// places anything, and orders the list the way the cell editor shows it.

const g1 = { id: 'g1', name: 'Aleph', tier_id: 't1', availability: 'all' }
const g2 = { id: 'g2', name: 'Bet', tier_id: 't1', availability: 'all' }
const day = (i) => ({ id: `d${i}`, label: `D${i}`, day_of_week: i + 1, sort_order: i })
const block = (i) => ({ id: `b${i}`, name: `B${i}`, start_time: `0${i}:00`, end_time: `0${i}:30`, sort_order: i, part_of_day: 'morning' })
const act = (id, o = {}) => ({ id, name: id, priority: 'high', min_per_week: 0, max_per_week: 5, max_groups_per_slot: null, same_tier_only: false, eligible_tier_ids: [], eligible_group_ids: [], prefer_before_day: null, prefer_before_day_min: null, ...o })

function input(o = {}) {
  return {
    groups: [g1], tiers: [{ id: 't1', name: 'Junior' }],
    days: [day(0)], timeBlocks: [block(1), block(2)],
    activities: [], fixedEvents: [], preplacedSlots: [],
    campId: 'test', replacedDayIds: [], locations: [],
    ...o,
  }
}
const at = (groupId, dayId, blockId) => ({ groupId, dayId, blockId })
const ids = (rows) => rows.map(r => r.activityId)

describe('probeCell — what fits in one cell', () => {
  it('lists every eligible activity as a fit in an empty week', () => {
    const r = probeCell(input({ activities: [act('Swim'), act('Archery')] }), at('g1', 'd0', 'b1'))
    expect(ids(r.fits)).toEqual(['Archery', 'Swim'])
    expect(r.blocked).toEqual([])
  })

  it('rules out what is already on today for this group, with the same cause an unfillable cell shows', () => {
    const r = probeCell(input({
      activities: [act('Swim'), act('Archery')],
      preplacedSlots: [{ ...at('g1', 'd0', 'b2'), activityId: 'Swim' }],
    }), at('g1', 'd0', 'b1'))
    expect(ids(r.fits)).toEqual(['Archery'])
    expect(r.blocked).toEqual([{ activityId: 'Swim', name: 'Swim', reason: 'Already on today' }])
  })

  it('rules out an activity another group holds at capacity in that period', () => {
    const r = probeCell(input({
      groups: [g1, g2],
      activities: [act('Cooking', { max_groups_per_slot: 1 }), act('Gaga')],
      preplacedSlots: [{ ...at('g2', 'd0', 'b1'), activityId: 'Cooking' }],
    }), at('g1', 'd0', 'b1'))
    expect(ids(r.fits)).toEqual(['Gaga'])
    expect(r.blocked).toEqual([{ activityId: 'Cooking', name: 'Cooking', reason: 'Activity at capacity' }])
  })

  it('rules out an activity at its weekly max', () => {
    const r = probeCell(input({
      days: [day(0), day(1)],
      activities: [act('Swim', { max_per_week: 1 }), act('Gaga')],
      preplacedSlots: [{ ...at('g1', 'd1', 'b1'), activityId: 'Swim' }],
    }), at('g1', 'd0', 'b1'))
    expect(r.blocked.map(b => b.reason)).toEqual(['Weekly max reached'])
  })

  it('lists first what is still short of its weekly minimum, with how many more', () => {
    const r = probeCell(input({
      days: [day(0), day(1)],
      activities: [act('Art', { min_per_week: 0 }), act('Swim', { min_per_week: 2 })],
      preplacedSlots: [{ ...at('g1', 'd1', 'b1'), activityId: 'Swim' }],
    }), at('g1', 'd0', 'b1'))
    expect(r.fits).toEqual([
      { activityId: 'Swim', name: 'Swim', note: 'Needs 1 more this week' },
      { activityId: 'Art', name: 'Art', note: null },
    ])
  })

  it('lists a rotation repeat last, noted, because Generate allows it there only as a last resort', () => {
    const r = probeCell(input({
      activities: [act('Boating', { rotate_every_weeks: 2 }), act('Gaga')],
      previousWeekUsage: [{ groupId: 'g1', activityId: 'Boating' }],
    }), at('g1', 'd0', 'b1'))
    expect(r.fits).toEqual([
      { activityId: 'Gaga', name: 'Gaga', note: null },
      { activityId: 'Boating', name: 'Boating', note: 'Had it last week' },
    ])
  })

  it('returns null for a cell the engine never fills (a fixed event)', () => {
    const lunch = act('Lunch')
    const anchor = { id: 'fe1', activity_id: 'Lunch', name: 'Lunch', unit_id: null, is_all_groups: true, group_ids: [], day_id: null, time_block_id: 'b1', span_blocks: 1 }
    expect(probeCell(input({ activities: [lunch, act('Gaga')], fixedEvents: [anchor] }), at('g1', 'd0', 'b1'))).toBeNull()
  })

  it('returns null for a group that is not in the week', () => {
    expect(probeCell(input({ activities: [act('Gaga')] }), at('nobody', 'd0', 'b1'))).toBeNull()
  })

  it('agrees with Generate: a cell Generate leaves unfillable has no fits, and its causes match', () => {
    const days = [day(0), day(1)]
    const activities = [act('Swim', { max_per_week: 1 })]
    const { slots } = buildSchedule(input({ days, timeBlocks: [block(1)], activities }))
    const placed = slots.find(s => s.type === 'activity' && s.activityId === 'Swim')
    const hole = slots.find(s => s.flags?.UNFILLABLE)
    const r = probeCell(input({
      days, timeBlocks: [block(1)], activities,
      preplacedSlots: [{ groupId: placed.groupId, dayId: placed.dayId, blockId: placed.blockId, activityId: 'Swim' }],
    }), at(hole.groupId, hole.dayId, hole.blockId))
    expect(r.fits).toEqual([])
    expect(r.blocked.map(b => `${b.name}: ${b.reason}`)).toEqual(hole.flags.UNFILLABLE_detail)
  })

  it('does not change what Generate produces for the same week', () => {
    const base = input({ groups: [g1, g2], activities: [act('Swim', { max_groups_per_slot: 1 }), act('Gaga')] })
    const before = buildSchedule(base)
    probeCell(base, at('g1', 'd0', 'b1'))
    expect(buildSchedule(base)).toEqual(before)
  })
})
