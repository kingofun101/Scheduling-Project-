// Daily spread for families of activities (schema v100: activities.spread_group, spread_max_per_day).
//
// An activity with a spread_group (e.g. 'Sports', 'Water') and a spread_max_per_day > 0 belongs to that
// family. One group should have at most spread_max_per_day activities of one family in a single day.
// The engine honours this while placing, and relaxes it once at the end so a cell nothing else can
// fill takes the extra one instead of staying empty. SPREAD findings report where that happened.

/** { key, label, max } for an activity that carries a spread rule, else null. */
export function spreadRule(activity) {
  const label = String(activity?.spread_group ?? '').trim()
  const max = Math.floor(Number(activity?.spread_max_per_day))
  if (!label || !(max > 0)) return null
  return { key: label.toLowerCase(), label, max }
}

export const spreadKey = (groupId, dayId, familyKey) => `${groupId}|${dayId}|${familyKey}`

/**
 * SPREAD findings: every (group, day, family) holding more activities than the family's daily limit.
 * `slots` may be engine slots (groupId/dayId/activityId) or stored rows (group_id/day_id/activity_id).
 * Mechanical wording only (findingsLanguage guardrail): what was set, what happened.
 */
export function spreadFindings({ slots, groups, activities, days }) {
  const rules = new Map()
  for (const a of activities || []) {
    const r = spreadRule(a)
    if (r) rules.set(a.id, r)
  }
  if (rules.size === 0) return []
  const groupName = new Map((groups || []).map((g) => [g.id, g.name]))
  const dayLabel = new Map((days || []).map((d) => [d.id, d.label]))
  const actName = new Map((activities || []).map((a) => [a.id, a.name]))
  const buckets = new Map() // spreadKey -> { groupId, dayId, rule, acts: [] }
  for (const s of slots || []) {
    const groupId = s.group_id ?? s.groupId
    const dayId = s.day_id ?? s.dayId
    const activityId = s.activity_id ?? s.activityId
    if (!groupId || !dayId || !activityId) continue
    if (s.is_span_head === false || s.is_span_head === 0) continue
    if (s.is_fixed_event) continue
    if (s.type && s.type !== 'activity') continue
    const rule = rules.get(activityId)
    if (!rule) continue
    const k = spreadKey(groupId, dayId, rule.key)
    if (!buckets.has(k)) buckets.set(k, { groupId, dayId, rule, acts: [] })
    buckets.get(k).acts.push(activityId)
  }
  const findings = []
  for (const b of buckets.values()) {
    if (b.acts.length <= b.rule.max) continue
    const extra = b.acts[b.rule.max] // first activity past the limit: the one that tipped it over
    findings.push({
      kind: 'SPREAD', groupId: b.groupId, activityId: extra, severity: 'caution',
      reason: `Daily limit of ${b.rule.max} ${b.rule.label} exceeded — ${b.acts.length} on ${dayLabel.get(b.dayId) ?? b.dayId} (group: ${groupName.get(b.groupId) ?? b.groupId}, activity: ${actName.get(extra) ?? extra})`,
    })
  }
  return findings
}
