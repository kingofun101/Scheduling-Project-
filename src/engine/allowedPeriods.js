// Per-division allowed periods for an activity (schema v99, activities.allowed_periods).
//
// Stored as JSON text: {"<tier_id>": ["<day_id>|<time_block_id>", ...]}. Read as:
//   - no value / unparseable / not an object  → no limits at all (every cell is allowed);
//   - a tier with NO entry                    → that division is unrestricted;
//   - a tier WITH an entry (even an empty one)→ only those (day, block) cells.
// The same every week. For a multi-block activity the HEAD block is what the entry names; the tail
// blocks follow from the activity's length and are not listed.
//
// One copy of the rule so the engine, the manual builder and the Activities screen cannot diverge
// (same reason eligibility.js exists).

/** Parse the stored value into Map<tierId, Set<"dayId|blockId">>, or null when there are no limits. */
export function parseAllowedPeriods(raw) {
  if (raw == null || raw === '') return null
  let value = raw
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw) } catch { return null }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const map = new Map()
  for (const [tierId, cells] of Object.entries(value)) {
    if (!Array.isArray(cells)) continue
    map.set(tierId, new Set(cells.filter((c) => typeof c === 'string')))
  }
  return map.size > 0 ? map : null
}

/** Serialize back to the stored form; null when nothing is restricted. */
export function serializeAllowedPeriods(map) {
  if (!map || map.size === 0) return null
  const out = {}
  for (const [tierId, cells] of map) out[tierId] = [...cells].sort()
  return JSON.stringify(out)
}

export const periodKey = (dayId, blockId) => `${dayId}|${blockId}`

/**
 * May `activity` start at (dayId, blockId) for `group`? `parsed` is an optional pre-parsed map
 * (the engine parses each activity once); otherwise the stored value is parsed here.
 */
export function isPeriodAllowed(activity, group, dayId, blockId, parsed) {
  const map = parsed === undefined ? parseAllowedPeriods(activity?.allowed_periods) : parsed
  if (!map) return true
  const cells = map.get(group?.tier_id)
  if (!cells) return true
  return cells.has(periodKey(dayId, blockId))
}
