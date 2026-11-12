import { probeCell } from '../../engine/buildSchedule'
import { resolveWeekCatalog } from '../../engine/weekCatalog'
import { resolvePriorityForGeneration } from '../../ingest/resolvePriorityForGeneration'
import { derivePreplacedSlots } from './preplacedSlots'

// "What fits here" for one cell of the Generated schedule, as the week stands now.
//
// Built from the same inputs generate() hands buildSchedule (useGeneration.js) so
// the list can never disagree with what Generate itself would allow: same week
// catalog, same priority resolution, same electives/events held in place. The one
// difference is deliberate: EVERY placed activity is held where it is (not only
// locked ones), because the question is "what can go here without moving
// anything", and the cell being asked about is left out.
//
// Returns probeCell's { fits, blocked }, or null when the engine never fills this
// cell (fixed event, elective, event, events-only row).
export function fitsForCell({
  storedSlots, cell,
  groups, tiers, days, timeBlocks, activities, fixedEvents, locations,
  electiveSetActivities, events, weekId, replacedDayIds, previousWeekUsage,
  activityExclusions, groupExclusions, locationExclusions, campId,
}) {
  const { groups: effGroups, activities: effActivities, fixedEvents: effFixedEvents } = resolveWeekCatalog({
    groups, activities, fixedEvents,
    weekId,
    activityExclusions: activityExclusions || [],
    groupExclusions: groupExclusions || [],
    locationExclusions: locationExclusions || [],
  })
  const isTarget = s => s.group_id === cell.groupId && s.day_id === cell.dayId && s.time_block_id === cell.blockId
  const held = (storedSlots || [])
    // Heads only: a span's head re-occupies its tails when placed, so a tail row
    // passed here would place the activity a second time.
    .filter(s => s.activity_id && !s.is_fixed_event && s.is_span_head !== false && !isTarget(s))
    .map(s => ({ groupId: s.group_id, dayId: s.day_id, blockId: s.time_block_id, activityId: s.activity_id }))
  // With no activity treated as locked, this yields exactly the elective and
  // event cells Generate keeps.
  const overlays = derivePreplacedSlots(storedSlots || [], [])
  return probeCell({
    groups: effGroups, tiers, days, timeBlocks,
    activities: resolvePriorityForGeneration(effActivities),
    fixedEvents: effFixedEvents, campId,
    preplacedSlots: [...held, ...overlays],
    locations, electiveSetActivities, events, weekId, replacedDayIds, previousWeekUsage,
  }, cell)
}
