import { describe, it, expect } from 'vitest'
import buildSchedule from './buildSchedule.js'

// Boating for Geza runs only Monday 1st and Thursday 4th period; every other activity is free.
const act = (id, extra) => ({ id, name: id, priority: 'high', min_per_week: 0, max_per_week: 5, max_groups_per_slot: 0, same_tier_only: false, eligible_tier_ids: [], eligible_group_ids: [], prefer_before_day: null, prefer_before_day_min: null, ...extra })
const block = (i) => ({ id: `b${i}`, name: `B${i}`, start_time: `0${i}:00`, end_time: `0${i}:50`, sort_order: i, part_of_day: 'morning' })
const days = [
  { id: 'mon', label: 'Monday', day_of_week: 1, sort_order: 0 },
  { id: 'tue', label: 'Tuesday', day_of_week: 2, sort_order: 1 },
  { id: 'thu', label: 'Thursday', day_of_week: 4, sort_order: 2 },
]
const input = (activities) => ({
  groups: [
    { id: 'g1', name: 'Geza 1', tier_id: 'geza', availability: 'all' },
    { id: 'g2', name: 'Geza 2', tier_id: 'geza', availability: 'all' },
    { id: 'g3', name: 'Other', tier_id: 'other', availability: 'all' },
  ],
  tiers: [{ id: 'geza', name: 'Geza' }, { id: 'other', name: 'Other' }],
  days, timeBlocks: [block(1), block(2), block(3), block(4)],
  activities, fixedEvents: [], campId: 'periods', replacedDayIds: [],
})
const cells = (slots, activityId, groupIds) =>
  slots.filter((s) => s.activityId === activityId && groupIds.includes(s.groupId)).map((s) => `${s.dayId}|${s.blockId}`)

describe('buildSchedule — allowed periods per activity and division', () => {
  const allowed = JSON.stringify({ geza: ['mon|b1', 'thu|b4'] })
  const activities = () => [
    act('Boating', { allowed_periods: allowed, max_per_week: 2 }),
    act('Archery'), act('Drama'), act('Swim'), act('Art'),
  ]

  it('only ever starts the activity in the division’s allowed periods', () => {
    const { slots } = buildSchedule(input(activities()))
    const boating = cells(slots, 'Boating', ['g1', 'g2'])
    expect(boating.length).toBeGreaterThan(0)
    for (const c of boating) expect(['mon|b1', 'thu|b4']).toContain(c)
  })

  it('leaves a division with no entry unrestricted', () => {
    const { slots } = buildSchedule(input(activities()))
    const other = cells(slots, 'Boating', ['g3'])
    expect(other.length).toBeGreaterThan(0)
    expect(other.some((c) => !['mon|b1', 'thu|b4'].includes(c))).toBe(true)
  })

  it('behaves exactly as before when allowed_periods is null', () => {
    const base = activities().map((a) => ({ ...a, allowed_periods: null }))
    const { slots } = buildSchedule(input(base))
    expect(slots.some((s) => s.activityId === 'Boating')).toBe(true)
  })

  it('an activity allowed in no period for a division is never placed for it', () => {
    const none = activities().map((a) => (a.id === 'Boating' ? { ...a, allowed_periods: JSON.stringify({ geza: [] }) } : a))
    const { slots } = buildSchedule(input(none))
    expect(cells(slots, 'Boating', ['g1', 'g2'])).toEqual([])
  })
})
