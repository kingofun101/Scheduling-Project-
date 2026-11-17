// Swap suggestions for a cell nothing could fill.
//
// A cell can be stuck only because another group is sitting in the place (or on the activity) it
// needs. If that other group could do something else in the same period, moving it frees the place:
//   "Give Geza 2 Nature instead of Hockey, then Shoresh 7 can have Kickball."
// Each suggestion changes one other group's cell and fills the stuck one, and is checked against the
// hard rules before it is offered: who the activity is open to, its allowed periods, its weekly
// maximum, once a day, the place's and the activity's capacity, and the group's part of day.
// Locked cells, spans, fixed events, electives and events are never moved. Soft preferences (daily
// spread, rotation, season order) are not checked: applying a suggestion goes through the normal
// placement path, which reports anything it leaves behind.

import { isActivityEligibleForGroup } from './eligibility.js'
import { isPeriodAllowed } from './allowedPeriods.js'
import { resolveElectiveOfferingLocations } from './electiveOccupancy.js'
import { normalizeActivityEligibility } from '../utils/normalizeActivityEligibility.js'

const isTrue = (v) => v === true || String(v) === '1'
const isActivityCell = (s) => Boolean(s.activity_id) && !isTrue(s.is_fixed_event) && !s.elective_set_id && !s.event_id
const isEmptyCell = (s) => !s.activity_id && !isTrue(s.is_fixed_event) && !s.elective_set_id && !s.event_id

/**
 * @param {object} p
 * @param {Array} p.slots           template_slots rows of the schedule being looked at
 * @param {Array} p.groups
 * @param {Array} p.activities
 * @param {Array} p.locations
 * @param {Array} p.timeBlocks
 * @param {Array} [p.electiveSetActivities]
 * @param {{groupId:string, dayId:string, blockId:string}} p.cell the stuck cell
 * @param {number} [p.max=8]
 * @returns {Array<{ targetActivityId, targetName, groupId, groupName, slotId, fromActivityId, fromName,
 *   toActivityId, toName, text }>}
 */
export function suggestSwaps({ slots, groups, activities, locations, timeBlocks, electiveSetActivities, cell, max = 8 }) {
  const acts = (activities || []).map(normalizeActivityEligibility)
  const actById = new Map(acts.map((a) => [a.id, a]))
  const groupById = new Map((groups || []).map((g) => [g.id, g]))
  const blockById = new Map((timeBlocks || []).map((b) => [b.id, b]))
  const capByLoc = new Map((locations || []).filter((l) => l.capacity > 0).map((l) => [l.id, l.capacity]))
  const offerings = new Map()
  for (const m of electiveSetActivities || []) {
    if (!offerings.has(m.elective_set_id)) offerings.set(m.elective_set_id, [])
    offerings.get(m.elective_set_id).push(m.activity_id)
  }

  const here = (slots || []).filter((s) => s.day_id === cell.dayId && s.time_block_id === cell.blockId)
  const target = here.find((s) => s.group_id === cell.groupId)
  if (!target || !isEmptyCell(target)) return []
  const stuckGroup = groupById.get(cell.groupId)
  if (!stuckGroup) return []

  const heads = (slots || []).filter((s) => isActivityCell(s) && !(s.is_span_head === false || String(s.is_span_head) === '0'))
  const weekCount = (groupId, actId, skipId) => heads.filter((s) => s.group_id === groupId && s.activity_id === actId && s.id !== skipId).length
  const onDay = (groupId, dayId, actId, skipId) => heads.some((s) => s.group_id === groupId && s.day_id === dayId && s.activity_id === actId && s.id !== skipId)

  // Groups in the place / on the activity at this (day, block), not counting `skipId`.
  // `extra` are placements that would exist after the move: [{ group_id, activity_id }].
  const placeUsers = (locId, skipId, extra = []) => [
    ...here.filter((s) => s.id !== skipId && (
      (s.activity_id && actById.get(s.activity_id)?.location_id === locId)
      || (s.elective_set_id && resolveElectiveOfferingLocations(offerings.get(s.elective_set_id), actById).has(locId)))),
    ...extra.filter((e) => actById.get(e.activity_id)?.location_id === locId),
  ]
  const activityUsers = (actId, skipId, extra = []) => [
    ...here.filter((s) => s.id !== skipId && s.activity_id === actId),
    ...extra.filter((e) => e.activity_id === actId),
  ]

  // Why `act` cannot go to `group` in this (day, block), as a list of codes ([] = it can).
  function blockedFor(act, group, skipId, extra = []) {
    const codes = []
    if ((act.span_blocks || 1) > 1) codes.push('span')
    if (!isActivityEligibleForGroup(act, group)) codes.push('eligible')
    if (!isPeriodAllowed(act, group, cell.dayId, cell.blockId)) codes.push('period')
    if (act.max_per_week != null && weekCount(group.id, act.id, skipId) >= act.max_per_week) codes.push('max')
    if (onDay(group.id, cell.dayId, act.id, skipId)) codes.push('today')
    const avail = group.availability
    const part = blockById.get(cell.blockId)?.part_of_day
    if (avail && avail !== 'all' && part && avail !== part) codes.push('partOfDay')
    const locId = act.location_id ?? null
    if (locId != null && capByLoc.has(locId) && placeUsers(locId, skipId, extra).filter((s) => s.group_id !== group.id).length >= capByLoc.get(locId)) codes.push('place')
    if (act.max_groups_per_slot > 0 && activityUsers(act.id, skipId, extra).filter((s) => s.group_id !== group.id).length >= act.max_groups_per_slot) codes.push('activity')
    return codes
  }

  const out = []
  const seen = new Set()
  for (const T of acts) {
    if (out.length >= max) break
    if (T.hidden || isTrue(T.is_hidden)) continue
    const codes = blockedFor(T, stuckGroup, null)
    if (codes.length === 0 || codes.some((c) => c !== 'place' && c !== 'activity')) continue
    // Who is in the way: the activity's own occupants when it is at capacity, the place's when the place is full.
    const blockers = new Map()
    if (codes.includes('activity')) for (const s of activityUsers(T.id, null)) blockers.set(s.id, s)
    const tLoc = T.location_id ?? null
    if (codes.includes('place') && tLoc != null) for (const s of placeUsers(tLoc, null)) if (isActivityCell(s)) blockers.set(s.id, s)
    for (const s of blockers.values()) {
      if (out.length >= max) break
      if (s.group_id === cell.groupId) continue
      if (s.is_span_head === false || String(s.is_span_head) === '0') continue
      const X = actById.get(s.activity_id)
      const H = groupById.get(s.group_id)
      if (!X || !H || (X.span_blocks || 1) > 1) continue
      if (X.is_locked && !isTrue(s.is_released)) continue
      if (X.min_per_week > 0 && weekCount(H.id, X.id, null) <= X.min_per_week) continue // would leave H short of a weekly minimum
      let offered = 0
      for (const Y of acts) {
        if (offered >= 2) break
        if (Y.id === X.id || Y.id === T.id || Y.hidden || isTrue(Y.is_hidden)) continue
        if (blockedFor(Y, H, s.id).length > 0) continue
        // T must fit once this group's cell is vacated and the group is doing Y instead.
        if (blockedFor(T, stuckGroup, s.id, [{ group_id: H.id, activity_id: Y.id }]).length > 0) continue
        const key = `${T.id}|${s.id}|${Y.id}`
        if (seen.has(key)) continue
        seen.add(key)
        offered++
        out.push({
          targetActivityId: T.id, targetName: T.name,
          groupId: H.id, groupName: H.name, slotId: s.id,
          fromActivityId: X.id, fromName: X.name, toActivityId: Y.id, toName: Y.name,
          text: `Give ${H.name} ${Y.name} instead of ${X.name}, then ${stuckGroup.name} can have ${T.name}`,
        })
        if (out.length >= max) break
      }
    }
  }
  return out
}
