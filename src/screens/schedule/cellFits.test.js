import { describe, it, expect } from 'vitest'
import { fitsForCell } from './cellFits'

// fitsForCell turns the STORED Generated week (snake_case rows, span tails
// included) into the engine's held cells and asks probeCell about one cell.

const g1 = { id: 'g1', name: 'Aleph', tier_id: 't1', availability: 'all' }
const g2 = { id: 'g2', name: 'Bet', tier_id: 't1', availability: 'all' }
const day = (i) => ({ id: `d${i}`, label: `D${i}`, day_of_week: i + 1, sort_order: i })
const block = (i) => ({ id: `b${i}`, name: `B${i}`, start_time: `0${i}:00`, end_time: `0${i}:30`, sort_order: i, part_of_day: 'morning' })
const act = (id, o = {}) => ({ id, name: id, priority: 'high', min_per_week: 0, max_per_week: 5, max_groups_per_slot: null, same_tier_only: false, eligible_tier_ids: [], eligible_group_ids: [], prefer_before_day: null, prefer_before_day_min: null, ...o })
const row = (group_id, day_id, time_block_id, activity_id, o = {}) => ({ id: `${group_id}-${day_id}-${time_block_id}`, group_id, day_id, time_block_id, activity_id, is_span_head: true, ...o })

function ask(storedSlots, cell, o = {}) {
  return fitsForCell({
    storedSlots, cell,
    groups: [g1, g2], tiers: [{ id: 't1', name: 'Junior' }],
    days: [day(0)], timeBlocks: [block(1), block(2), block(3)],
    activities: [act('Swim', { max_groups_per_slot: 1 }), act('Gaga'), act('Canoe', { span_blocks: 2 })],
    fixedEvents: [], locations: [], electiveSetActivities: [], events: [],
    weekId: null, replacedDayIds: [], previousWeekUsage: [], campId: 'test',
    ...o,
  })
}
const fitIds = r => r.fits.map(f => f.activityId)

describe('fitsForCell', () => {
  it('holds every placed cell where it is — another bunk at capacity rules the activity out here', () => {
    const r = ask([row('g2', 'd0', 'b1', 'Swim')], { groupId: 'g1', dayId: 'd0', blockId: 'b1' })
    expect(fitIds(r)).not.toContain('Swim')
    expect(r.blocked).toContainEqual({ activityId: 'Swim', name: 'Swim', reason: 'Activity at capacity' })
  })

  it('leaves the asked-about cell out, so what is stored there does not block itself', () => {
    const r = ask([row('g1', 'd0', 'b1', 'Gaga')], { groupId: 'g1', dayId: 'd0', blockId: 'b1' })
    expect(fitIds(r)).toContain('Gaga')
  })

  it('reads a stored two-period activity (head + tail rows) as one placement', () => {
    // Canoe spans b1-b2 for g1, stored as a head row and a tail row. The cell
    // after it, b3, is free: Canoe is ruled out only because it already ran today.
    const stored = [
      row('g1', 'd0', 'b1', 'Canoe'),
      row('g1', 'd0', 'b2', 'Canoe', { is_span_head: false }),
    ]
    const r = ask(stored, { groupId: 'g1', dayId: 'd0', blockId: 'b3' })
    expect(fitIds(r)).toEqual(['Gaga', 'Swim'])
    expect(r.blocked).toContainEqual({ activityId: 'Canoe', name: 'Canoe', reason: 'Already on today' })
  })

  it('returns null for a cell the engine never fills', () => {
    expect(ask([], { groupId: 'nobody', dayId: 'd0', blockId: 'b1' })).toBeNull()
  })
})
