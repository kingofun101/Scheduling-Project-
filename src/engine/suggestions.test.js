import { describe, it, expect } from 'vitest'
import { suggestSwaps } from './suggestions.js'

const days = [{ id: 'd1' }, { id: 'd2' }]
const timeBlocks = [{ id: 'b1', part_of_day: 'morning' }]
const groups = [
  { id: 's7', name: 'Shoresh 7', tier_id: 'T', availability: 'all' },
  { id: 'g2', name: 'Geza 2', tier_id: 'T', availability: 'all' },
]
const locations = [{ id: 'field', name: 'Field', capacity: 1 }]
const act = (id, extra) => ({ id, name: id, max_per_week: 1, min_per_week: 0, span_blocks: 1, max_groups_per_slot: 0, eligible_tier_ids: [], eligible_group_ids: [], location_id: null, allowed_periods: null, ...extra })
const base = () => ({
  groups, days, timeBlocks, locations,
  activities: [act('Kickball', { location_id: 'field' }), act('Soccer', { location_id: 'field' }), act('Nature'), act('Arts')],
  slots: [
    { id: 'c1', group_id: 's7', day_id: 'd1', time_block_id: 'b1', activity_id: null },           // the stuck cell
    { id: 'c2', group_id: 'g2', day_id: 'd1', time_block_id: 'b1', activity_id: 'Soccer' },        // sits in the Field
  ],
  cell: { groupId: 's7', dayId: 'd1', blockId: 'b1' },
})

describe('suggestSwaps', () => {
  it('suggests moving the group in the full place to something else so the stuck cell can have the blocked activity', () => {
    const out = suggestSwaps(base())
    expect(out.length).toBeGreaterThan(0)
    const s = out.find((x) => x.targetActivityId === 'Kickball' && x.fromActivityId === 'Soccer')
    expect(s).toMatchObject({ groupId: 'g2', slotId: 'c2' })
    expect(['Nature', 'Arts']).toContain(s.toActivityId)
    expect(s.text).toBe(`Give Geza 2 ${s.toName} instead of Soccer, then Shoresh 7 can have Kickball`)
  })

  it('does not move the group into another activity at the same full place', () => {
    const p = base()
    p.activities = [act('Kickball', { location_id: 'field' }), act('Soccer', { location_id: 'field' })]   // the only alternative is in the Field too
    expect(suggestSwaps(p)).toEqual([])
  })

  it('offers nothing when the stuck cell is not empty', () => {
    const p = base(); p.slots[0] = { ...p.slots[0], activity_id: 'Arts' }
    expect(suggestSwaps(p)).toEqual([])
  })

  it('does not move a locked activity, a span, or a group that would drop below a weekly minimum', () => {
    const locked = base(); locked.activities[1] = { ...locked.activities[1], is_locked: true }
    expect(suggestSwaps(locked).filter((x) => x.fromActivityId === 'Soccer')).toEqual([])
    const span = base(); span.activities[1] = { ...span.activities[1], span_blocks: 2 }
    expect(suggestSwaps(span).filter((x) => x.fromActivityId === 'Soccer')).toEqual([])
    const min = base(); min.activities[1] = { ...min.activities[1], min_per_week: 1 }
    expect(suggestSwaps(min).filter((x) => x.fromActivityId === 'Soccer')).toEqual([])
  })

  it('only offers an alternative the moved group may have: allowed period, weekly max, once a day', () => {
    const p = base()
    p.activities = p.activities.map((a) => (a.id === 'Nature' ? { ...a, allowed_periods: JSON.stringify({ T: ['d2|b1'] }) } : a))   // Nature not allowed d1|b1
    p.slots.push({ id: 'c3', group_id: 'g2', day_id: 'd2', time_block_id: 'b1', activity_id: 'Arts' })                                 // Geza 2 already has Arts this week
    const out = suggestSwaps(p)
    expect(out.filter((x) => x.fromActivityId === 'Soccer')).toEqual([])
  })

  it('ignores a stuck cell blocked for another reason (the group already has the activity this week)', () => {
    const p = base()
    p.slots.push({ id: 'c4', group_id: 's7', day_id: 'd2', time_block_id: 'b1', activity_id: 'Kickball' })
    expect(suggestSwaps(p).filter((x) => x.targetActivityId === 'Kickball')).toEqual([])
  })

  it('finds the blocker on an activity at its own capacity, not only on a full place', () => {
    const p = base()
    p.activities = [act('Boating', { max_groups_per_slot: 1 }), act('Nature'), act('Arts')]
    p.slots[1] = { ...p.slots[1], activity_id: 'Boating' }
    const out = suggestSwaps(p)
    expect(out.find((x) => x.targetActivityId === 'Boating' && x.groupId === 'g2')).toBeTruthy()
  })

  it('reads eligibility lists stored as JSON text and caps the list', () => {
    const p = base()
    p.activities = p.activities.map((a) => ({ ...a, eligible_tier_ids: '[]', eligible_group_ids: null }))
    expect(suggestSwaps({ ...p, max: 1 })).toHaveLength(1)
  })
})
