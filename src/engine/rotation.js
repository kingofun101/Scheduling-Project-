// Rotation for very popular activities (schema v99, activities.rotate_every_weeks).
//
// An activity with rotate_every_weeks > 1 is one a group should not get two weeks running (2 = at most
// every other week; a camp with 60 bunks and 25 boating periods a week cannot give everyone boating
// weekly). This is a PREFERENCE: Generate avoids a repeat while anything else can fill the cell, and
// only falls back to a repeat rather than leave the cell empty, then says so with a ROTATION finding.
//
// The engine builds one week at a time, so the previous week arrives as an input:
//   previousWeekUsage = [{ groupId, activityId, count, lastWeek }, ...]  one entry per group/activity pair
//   that had the activity in any earlier week: `count` is how many earlier weeks had it, `lastWeek` is true
//   when the week immediately before had it. Rotation reads `lastWeek`; season fairness (buildSchedule's
//   preference for what a group has done least) reads `count`. It is empty/absent for the first week.

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
 * Per (group, activity) pair, how many earlier weeks had the activity, and whether the week immediately
 * before `weekId` did. `templates` are schedule_templates rows, `slots` template_slots rows (either
 * snake_case stored rows or camelCase engine slots). Both of a week's candidate schedules (Manual and
 * Generated) count: neither is canonical, so a pair seen in either counts, and at most once per week.
 */
export function previousWeekUsage({ weeks, weekId, templates, slots }) {
  const ordered = liveWeeksInOrder(weeks)
  const at = ordered.findIndex((w) => w.id === weekId)
  if (at <= 0) return []
  const earlier = ordered.slice(0, at)
  const lastWeekId = earlier[earlier.length - 1].id
  const weekOfTemplate = new Map()
  const earlierIds = new Set(earlier.map((w) => w.id))
  for (const t of templates || []) if (earlierIds.has(t.week_id)) weekOfTemplate.set(t.id, t.week_id)
  const perWeek = new Map() // pairKey -> Set(weekId)
  const pairs = new Map() // pairKey -> { groupId, activityId }
  for (const s of slots || []) {
    const wk = weekOfTemplate.get(s.template_id ?? s.templateId)
    if (!wk) continue
    const groupId = s.group_id ?? s.groupId
    const activityId = s.activity_id ?? s.activityId
    if (!groupId || !activityId || s.is_fixed_event) continue
    const k = pairKey(groupId, activityId)
    if (!perWeek.has(k)) { perWeek.set(k, new Set()); pairs.set(k, { groupId, activityId }) }
    perWeek.get(k).add(wk)
  }
  const out = []
  for (const [k, weeksSeen] of perWeek) {
    out.push({ ...pairs.get(k), count: weeksSeen.size, lastWeek: weeksSeen.has(lastWeekId) })
  }
  return out
}

/** The set of "groupId|activityId" pairs that would REPEAT if placed again this week. */
export function repeatedPairs(activities, usage) {
  const rotating = new Set((activities || []).filter(rotates).map((a) => a.id))
  const set = new Set()
  for (const u of usage || []) if (u.lastWeek !== false && rotating.has(u.activityId)) set.add(pairKey(u.groupId, u.activityId))
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

/**
 * How many earlier weeks each group has had each activity: Map("groupId|activityId" -> count).
 * Entries without a `count` (older callers) count as one earlier week.
 */
export function seasonCounts(usage) {
  const m = new Map()
  for (const u of usage || []) m.set(pairKey(u.groupId, u.activityId), Number.isFinite(u.count) ? u.count : 1)
  return m
}
