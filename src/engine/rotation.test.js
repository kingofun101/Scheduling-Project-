import { describe, it, expect } from 'vitest'
import { rotates, previousWeek, previousWeekUsage, repeatedPairs, rotationRepeatFindings } from './rotation.js'

const weeks = [
  { id: 'w3', name: 'Week 3', sort_order: 2 },
  { id: 'w1', name: 'Week 1', sort_order: 0 },
  { id: 'w2', name: 'Week 2', sort_order: 1 },
  { id: 'wx', name: 'Old', sort_order: 1.5, is_archived: 1 },
]

describe('rotates', () => {
  it('is on only for a rotate_every_weeks above 1', () => {
    expect([null, undefined, 0, 1, '1'].map((v) => rotates({ rotate_every_weeks: v }))).toEqual([false, false, false, false, false])
    expect([2, 3, '2'].map((v) => rotates({ rotate_every_weeks: v }))).toEqual([true, true, true])
  })
})

describe('previousWeek', () => {
  it('walks weeks in sort order, skipping archived ones', () => {
    expect(previousWeek(weeks, 'w3').id).toBe('w2')
    expect(previousWeek(weeks, 'w2').id).toBe('w1')
  })
  it('reads is_archived however it is stored', () => {
    const w = [{ id: 'a', sort_order: 0, is_archived: '0' }, { id: 'b', sort_order: 1, is_archived: '1' }, { id: 'c', sort_order: 2, is_archived: 0 }]
    expect(previousWeek(w, 'c').id).toBe('a')
  })
  it('has none before the first week or for an unknown week', () => {
    expect(previousWeek(weeks, 'w1')).toBeNull()
    expect(previousWeek(weeks, 'nope')).toBeNull()
    expect(previousWeek([], 'w1')).toBeNull()
  })
})

describe('previousWeekUsage', () => {
  const templates = [
    { id: 't2m', week_id: 'w2', kind: 'manual' }, { id: 't2g', week_id: 'w2', kind: 'generated' },
    { id: 't3g', week_id: 'w3', kind: 'generated' },
  ]
  const slots = [
    { template_id: 't2g', group_id: 'g1', activity_id: 'Boating' },
    { template_id: 't2g', group_id: 'g1', activity_id: 'Boating' }, // same pair twice -> once
    { template_id: 't2m', group_id: 'g2', activity_id: 'Boating' }, // the other candidate counts too
    { template_id: 't2g', group_id: 'g3', activity_id: 'Lunch', is_fixed_event: 1 }, // fixed event: ignored
    { template_id: 't3g', group_id: 'g9', activity_id: 'Boating' }, // not the previous week
    { template_id: 't2g', group_id: 'g4', activity_id: null },
  ]
  it('lists each group/activity pair that had the activity the week before, from either candidate', () => {
    expect(previousWeekUsage({ weeks, weekId: 'w3', templates, slots })).toEqual([
      { groupId: 'g1', activityId: 'Boating' }, { groupId: 'g2', activityId: 'Boating' },
    ])
  })
  it('is empty for the first week', () => {
    expect(previousWeekUsage({ weeks, weekId: 'w1', templates, slots })).toEqual([])
  })
})

describe('repeatedPairs / rotationRepeatFindings', () => {
  const activities = [{ id: 'Boating', name: 'Boating', rotate_every_weeks: 2 }, { id: 'Archery', name: 'Archery' }]
  const groups = [{ id: 'g1', name: 'Geza 1' }]
  const usage = [{ groupId: 'g1', activityId: 'Boating' }, { groupId: 'g1', activityId: 'Archery' }]
  it('only flagged activities can repeat', () => {
    expect([...repeatedPairs(activities, usage)]).toEqual(['g1|Boating'])
  })
  it('reports a flagged activity placed again, once per pair, for engine or stored slot shapes', () => {
    const engine = [
      { groupId: 'g1', activityId: 'Boating', type: 'activity', is_span_head: true },
      { groupId: 'g1', activityId: 'Boating', type: 'activity', is_span_head: true },
      { groupId: 'g1', activityId: 'Archery', type: 'activity', is_span_head: true },
    ]
    const stored = [{ group_id: 'g1', activity_id: 'Boating' }]
    for (const slots of [engine, stored]) {
      const f = rotationRepeatFindings({ slots, groups, activities, usage })
      expect(f).toHaveLength(1)
      expect(f[0]).toMatchObject({ kind: 'ROTATION', groupId: 'g1', activityId: 'Boating', severity: 'caution' })
      expect(f[0].reason).toContain('Geza 1')
    }
  })
  it('reports nothing without last-week data, or when the repeat was not placed', () => {
    expect(rotationRepeatFindings({ slots: [{ group_id: 'g1', activity_id: 'Boating' }], groups, activities, usage: [] })).toEqual([])
    expect(rotationRepeatFindings({ slots: [{ group_id: 'g1', activity_id: 'Archery' }], groups, activities, usage })).toEqual([])
  })
})
