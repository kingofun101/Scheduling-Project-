// Season fairness report: across the weeks built so far, how often each group had each activity, and
// which activities are split unevenly among the groups of a division.
//
// "Uneven" = the group that had an activity most often had it `minSpread` or more times more than the
// group that had it least (default 3: 4 times against once is flagged; 3 against 2 is not). Only groups
// the activity is open to are compared.
//
// Reads stored rows (snake_case: template_slots, schedule_templates, schedule_weeks) or engine slots.

import { isActivityEligibleForGroup } from './eligibility.js'
import { normalizeActivityEligibility } from '../utils/normalizeActivityEligibility.js'

export const DEFAULT_MIN_SPREAD = 3

const isArchived = (w) => w.is_archived === true || String(w.is_archived) === '1'

/** A slot that is a free-choice activity placement (not a fixed event, elective, event or span tail). */
function isActivityHead(s) {
  if (s.is_fixed_event === true || String(s.is_fixed_event) === '1') return false
  if (s.is_span_head === false || String(s.is_span_head) === '0') return false
  if (s.elective_set_id || s.electiveSetId || s.event_id || s.eventId) return false
  return Boolean(s.activity_id ?? s.activityId)
}

/**
 * The weeks to count, in order, each with the schedule (template) that represents it. A week can hold
 * a Manual and a Generated schedule and neither is canonical, so the fuller one counts (ties go to
 * the Generated one). Weeks with no placements are left out.
 */
export function weeksWithSchedules({ weeks, templates, slots }) {
  const perTemplate = new Map()
  for (const s of slots || []) {
    if (!isActivityHead(s)) continue
    const t = s.template_id ?? s.templateId
    perTemplate.set(t, (perTemplate.get(t) || 0) + 1)
  }
  const ordered = (weeks || [])
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => !isArchived(w))
    .sort((a, b) => (a.w.sort_order ?? a.i) - (b.w.sort_order ?? b.i) || a.i - b.i)
    .map(({ w }) => w)
  const out = []
  for (const w of ordered) {
    const cands = (templates || []).filter((t) => t.week_id === w.id)
    let best = null
    let bestN = 0
    for (const t of cands) {
      const n = perTemplate.get(t.id) || 0
      if (n > bestN || (n === bestN && n > 0 && t.kind === 'generated')) { best = t; bestN = n }
    }
    if (best) out.push({ week: w, templateId: best.id, placements: bestN })
  }
  return out
}

/**
 * @returns {{ weeks: Array<{id, name}>, minSpread: number, flaggedTotal: number,
 *   tiers: Array<{ tierId, name, groups: Array<{id, name, total, distinct, missing: string[]}>,
 *     rows: Array<{ activityId, name, counts: Array<number|null>, min, max, spread, flagged }>, flaggedCount }> }}
 */
export function seasonFairness({ weeks, templates, slots, groups, tiers, activities, minSpread = DEFAULT_MIN_SPREAD }) {
  const used = weeksWithSchedules({ weeks, templates, slots })
  if (used.length === 0) return { weeks: [], minSpread, flaggedTotal: 0, tiers: [] }
  const templateIds = new Set(used.map((u) => u.templateId))
  const counts = new Map() // `${groupId}|${activityId}` -> n
  const placedAnywhere = new Set()
  for (const s of slots || []) {
    if (!isActivityHead(s)) continue
    if (!templateIds.has(s.template_id ?? s.templateId)) continue
    const g = s.group_id ?? s.groupId
    const a = s.activity_id ?? s.activityId
    const k = `${g}|${a}`
    counts.set(k, (counts.get(k) || 0) + 1)
    placedAnywhere.add(a)
  }
  // Stored rows hold the eligibility lists as JSON text; read them as arrays.
  const actList = (activities || []).filter((a) => placedAnywhere.has(a.id)).map(normalizeActivityEligibility)
  const tierName = new Map((tiers || []).map((t) => [t.id, t.name]))
  const byTier = new Map()
  for (const g of groups || []) {
    const key = g.tier_id ?? '__none__'
    if (!byTier.has(key)) byTier.set(key, [])
    byTier.get(key).push(g)
  }
  const result = []
  let flaggedTotal = 0
  const tierOrder = [...(tiers || []).map((t) => t.id), ...[...byTier.keys()].filter((k) => !tierName.has(k))]
  for (const tierId of tierOrder) {
    const gs = byTier.get(tierId)
    if (!gs || gs.length === 0) continue
    const rows = []
    for (const a of actList) {
      const elig = gs.map((g) => isActivityEligibleForGroup(a, g))
      if (!elig.some(Boolean)) continue
      const c = gs.map((g, i) => (elig[i] ? counts.get(`${g.id}|${a.id}`) || 0 : null))
      const vals = c.filter((x) => x !== null)
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      if (max === 0) continue // nobody in this division had it: nothing to compare
      const spread = max - min
      rows.push({ activityId: a.id, name: a.name, counts: c, min, max, spread, flagged: vals.length > 1 && spread >= minSpread })
    }
    rows.sort((x, y) => Number(y.flagged) - Number(x.flagged) || y.spread - x.spread || String(x.name).localeCompare(String(y.name)))
    const groupsOut = gs.map((g, i) => {
      let total = 0
      let distinct = 0
      const missing = []
      for (const r of rows) {
        const n = r.counts[i]
        if (n === null) continue
        total += n
        if (n > 0) distinct += 1
        else missing.push(r.name)
      }
      return { id: g.id, name: g.name, total, distinct, missing }
    })
    const flaggedCount = rows.filter((r) => r.flagged).length
    flaggedTotal += flaggedCount
    result.push({ tierId, name: tierName.get(tierId) ?? 'Other', groups: groupsOut, rows, flaggedCount })
  }
  return { weeks: used.map((u) => ({ id: u.week.id, name: u.week.name || null })), minSpread, flaggedTotal, tiers: result }
}
