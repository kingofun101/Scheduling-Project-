import { describe, it, expect } from 'vitest'
import { seasonFairness, weeksWithSchedules } from './fairness.js'

const weeks = [{ id: 'w1', name: 'Week 1', sort_order: 0 }, { id: 'w2', name: 'Week 2', sort_order: 1 }, { id: 'w3', sort_order: 2, is_archived: 1 }]
const templates = [
  { id: 't1m', week_id: 'w1', kind: 'manual' }, { id: 't1g', week_id: 'w1', kind: 'generated' },
  { id: 't2g', week_id: 'w2', kind: 'generated' }, { id: 't3g', week_id: 'w3', kind: 'generated' },
]
const tiers = [{ id: 'T', name: 'Geza' }, { id: 'U', name: 'Elon' }]
const groups = [{ id: 'g1', name: 'Geza 1', tier_id: 'T' }, { id: 'g2', name: 'Geza 2', tier_id: 'T' }, { id: 'e1', name: 'Elon 1', tier_id: 'U' }]
const activities = [
  { id: 'kick', name: 'Kickball', eligible_tier_ids: [], eligible_group_ids: [] },
  { id: 'arts', name: 'Arts', eligible_tier_ids: ['T'], eligible_group_ids: [] },
  { id: 'rare', name: 'Rare', eligible_tier_ids: [], eligible_group_ids: [] },
]
// g1 has Kickball in four weeks' worth of slots; g2 once.
const slot = (template_id, group_id, activity_id, extra = {}) => ({ template_id, group_id, activity_id, ...extra })
const slots = [
  slot('t1g', 'g1', 'kick'), slot('t1g', 'g1', 'kick'), slot('t2g', 'g1', 'kick'), slot('t2g', 'g1', 'kick'),
  slot('t1g', 'g2', 'kick'),
  slot('t1g', 'g1', 'arts'), slot('t1g', 'g2', 'arts'), slot('t2g', 'g2', 'arts'),
  slot('t1m', 'g1', 'rare'),                                   // the other, emptier candidate of week 1: ignored
  slot('t3g', 'g1', 'arts'),                                   // archived week: ignored
  slot('t1g', 'g1', 'kick', { is_fixed_event: 1 }),            // fixed event: ignored
  slot('t1g', 'g1', 'kick', { is_span_head: 0 }),              // span tail: ignored
  slot('t1g', 'e1', 'kick'),
]

describe('weeksWithSchedules', () => {
  it('uses the fuller schedule of each live week and skips archived or empty weeks', () => {
    const u = weeksWithSchedules({ weeks, templates, slots })
    expect(u.map((x) => [x.week.id, x.templateId])).toEqual([['w1', 't1g'], ['w2', 't2g']])
  })
})

describe('seasonFairness', () => {
  it('reads eligibility lists stored as JSON text', () => {
    const stored = [{ id: 'kick', name: 'Kickball', eligible_tier_ids: '[]', eligible_group_ids: null }, { id: 'arts', name: 'Arts', eligible_tier_ids: '["T"]', eligible_group_ids: '[]' }]
    const out = seasonFairness({ weeks, templates, slots, groups, tiers, activities: stored })
    expect(out.tiers.find((t) => t.name === 'Geza').rows.map((x) => x.name).sort()).toEqual(['Arts', 'Kickball'])
    expect(out.tiers.find((t) => t.name === 'Elon').rows.map((x) => x.name)).toEqual(['Kickball'])
  })

  const r = seasonFairness({ weeks, templates, slots, groups, tiers, activities })

  it('counts per group within each division and flags a spread of 3 or more', () => {
    const geza = r.tiers.find((t) => t.name === 'Geza')
    const kick = geza.rows.find((x) => x.name === 'Kickball')
    expect(kick.counts).toEqual([4, 1])
    expect(kick).toMatchObject({ min: 1, max: 4, spread: 3, flagged: true })
    const arts = geza.rows.find((x) => x.name === 'Arts')
    expect(arts.counts).toEqual([1, 2])
    expect(arts.flagged).toBe(false)
    expect(geza.flaggedCount).toBe(1)
    expect(r.flaggedTotal).toBe(1)
  })
  it('lists flagged activities first and leaves out activities nobody in the division had', () => {
    const geza = r.tiers.find((t) => t.name === 'Geza')
    expect(geza.rows[0].name).toBe('Kickball')
    expect(geza.rows.map((x) => x.name)).not.toContain('Rare')
  })
  it('treats a group an activity is not open to as not compared (null), and totals each group', () => {
    const elon = r.tiers.find((t) => t.name === 'Elon')
    expect(elon.rows.map((x) => x.name)).toEqual(['Kickball'])   // Arts is Geza-only
    const geza = r.tiers.find((t) => t.name === 'Geza')
    expect(geza.groups.find((g) => g.id === 'g1')).toMatchObject({ total: 5, distinct: 2 })
    expect(geza.groups.find((g) => g.id === 'g2')).toMatchObject({ total: 3, distinct: 2 })
  })
  it('names what a group has not had yet, among what its division did', () => {
    const e = seasonFairness({ weeks, templates, slots: [slot('t1g', 'g1', 'kick'), slot('t1g', 'g2', 'arts')], groups, tiers, activities })
    const geza = e.tiers.find((t) => t.name === 'Geza')
    expect(geza.groups.find((g) => g.id === 'g1').missing).toEqual(['Arts'])
    expect(geza.groups.find((g) => g.id === 'g2').missing).toEqual(['Kickball'])
  })
  it('honours a different threshold', () => {
    const strict = seasonFairness({ weeks, templates, slots, groups, tiers, activities, minSpread: 1 })
    expect(strict.tiers.find((t) => t.name === 'Geza').flaggedCount).toBe(2)
  })
  it('is empty with no schedules', () => {
    expect(seasonFairness({ weeks, templates, slots: [], groups, tiers, activities })).toMatchObject({ weeks: [], tiers: [], flaggedTotal: 0 })
  })
})
