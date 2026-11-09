// Rotation for very popular activities (schema v99, activities.rotate_every_weeks).
//
// An activity with rotate_every_weeks > 1 is one a group should not get two weeks running (2 = at most
// every other week; a camp with 60 bunks and 25 boating periods a week cannot give everyone boating
// weekly). This is a PREFERENCE: Generate avoids a repeat while anything else can fill the cell, and
// only falls back to a repeat rather than leave the cell empty, then says so with a ROTATION finding.
//
// The engine builds one week at a time, so the previous week arrives as an input:
//   previousWeekUsage = [{ groupId, activityId }, ...]  (one entry per group/activity pair that had
//   the activity last week). It is empty/absent for the first week.

export const rotates = (activity) => Number(activity?.rotate_every_weeks) > 1

const pairKey = (groupId, activityId) => `${groupId}|${activityId}`

/**
 * The weeks Generate walks in order: archived ones are skipped; ordered by sort_order, then by the
 * order they were listed in (stable).
 */
// is_archived arrives as 0/1, '0'/'1' or a boolean depending on the path it took.
const isArchived = (w) => w.is_archived === true || String(w.is_archived) === '1'

function liveWeeksInOrder(weeks) {
  return (weeks || [])
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => !isArchived(w))
    .sort((a, b) => (a.w.sort_order ?? a.i) - (b.w.sort_order ?? b.i) || a.i - b.i)
    .map(({ w }) => w)
}

/** The week immediately before `weekId`, or null for the first week / an unknown week. */
export function previousWeek(weeks, weekId) {
  const ordered = liveWeeksInOrder(weeks)
  const at = ordered.findIndex((w) => w.id === weekId)
  return at > 0 ? ordered[at - 1] : null
}

/**
 * Which (group, activity) pairs had an activity in the week before `weekId`.
 * `templates` are schedule_templates rows, `slots` template_slots rows (either snake_case stored
 * rows or camelCase engine slots). Both of that week's candidate schedules (Manual and Generated)
 * count: neither is canonical, so a pair seen in either is treated as "had it last week".
 */
export function previousWeekUsage({ weeks, weekId, templates, slots }) {
  const prev = previousWeek(weeks, weekId)
  if (!prev) return []
  const templateIds = new Set((templates || []).filter((t) => t.week_id === prev.id).map((t) => t.id))
  const seen = new Set()
  const out = []
  for (const s of slots || []) {
    if (!templateIds.has(s.template_id ?? s.templateId)) continue
    const groupId = s.group_id ?? s.groupId
    const activityId = s.activity_id ?? s.activityId
    if (!groupId || !activityId || s.is_fixed_event) continue
    const k = pairKey(groupId, activityId)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({ groupId, activityId })
  }
  return out
}

/** The set of "groupId|activityId" pairs that would REPEAT if placed again this week. */
export function repeatedPairs(activities, usage) {
  const rotating = new Set((activities || []).filter(rotates).map((a) => a.id))
  const set = new Set()
  for (const u of usage || []) if (rotating.has(u.activityId)) set.add(pairKey(u.groupId, u.activityId))
  return set
}

export { pairKey }

/**
 * ROTATION findings: every (group, rotating activity) placed this week that was also placed last week.
 * `slots` may be engine slots (groupId/activityId) or stored rows (group_id/activity_id).
 * Mechanical wording only (findingsLanguage guardrail): what was set, what happened.
 */
export function rotationRepeatFindings({ slots, groups, activities, usage }) {
  const repeated = repeatedPairs(activities, usage)
  if (repeated.size === 0) return []
  const groupName = new Map((groups || []).map((g) => [g.id, g.name]))
  const actById = new Map((activities || []).map((a) => [a.id, a]))
  const seen = new Set()
  const findings = []
  for (const s of slots || []) {
    const groupId = s.group_id ?? s.groupId
    const activityId = s.activity_id ?? s.activityId
    if (!groupId || !activityId) continue
    if (s.is_span_head === false || s.is_span_head === 0) continue
    if (s.is_fixed_event) continue
    if (s.type && s.type !== 'activity') continue
    const k = pairKey(groupId, activityId)
    if (!repeated.has(k) || seen.has(k)) continue
    seen.add(k)
    const act = actById.get(activityId)
    findings.push({
      kind: 'ROTATION', groupId, activityId, severity: 'caution',
      reason: `Set to every other week — also scheduled last week (group: ${groupName.get(groupId) ?? groupId}, activity: ${act?.name ?? activityId})`,
    })
  }
  return findings
}
