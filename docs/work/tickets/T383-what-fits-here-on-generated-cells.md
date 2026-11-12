---
title: T383-what-fits-here-on-generated-cells
document_type: ticket
status: in-progress
created: 2026-11-12
task_class: scheduling-engine
governing_docs: [docs/governance/GOVERNANCE_INDEX.md, docs/governance/constitution/CONSTITUTION.md, docs/governance/standards/ARCHITECTURE_STANDARD.md, docs/governance/standards/DESIGN_STANDARD.md]
archive_when: on the Generated schedule, opening the editor on an open or unfillable cell lists what can go there as the week stands, judged by Generate's own rules, and picking one places it; pinned by src/engine/probeCell.test.js and confirmed by the owner in the installed app
---

# T383 — "What fits here" on open and unfillable Generated cells

**Asked for by the owner, 2026-11-12:** after the problem-cell locator (an unfillable cell now
lists what was ruled out and why), "can it show what can be used to fill the period".

**Task class:** scheduling-engine (reads the engine's rule check; does not change placement or
the flag taxonomy) with a UI surface in the cell editor.

## What it does

Double-click (or Enter, or right-click) an **Open** or **Unfillable** cell on the Generated
schedule. Before anything is typed, the editor lists **Fits here**: the activities that can go in
that cell right now without moving anything else. Picking one places it through the existing
place path (`handleCellPlace`), so undo, ordering and the write are unchanged. Typing still searches
every eligible activity, as before.

Order: an activity still short of its weekly minimum first, noted "Needs N more this week"; then
fewest times this week; then name. An activity that would repeat last week's rotation is listed
last, noted "Had it last week" — Generate allows that only as a last resort, and so does this list.
When nothing fits, the editor says **Nothing fits here right now** instead of an empty list
(Constitution Article V: surface, never hide).

## How it decides — one rule, not two

`probeCell` (`src/engine/buildSchedule.js`) runs the same cohort setup Generate runs, holds every
currently placed cell where it is, and asks the same `blockedBy()` Pass 2 uses about each eligible
activity at the one cell, then stops before placing anything. It cannot disagree with Generate by
construction; `probeCell.test.js` pins that a cell Generate leaves unfillable gets no fits and the
same per-activity causes as its `UNFILLABLE_detail`, and that probing does not change what
Generate produces.

`fitsForCell` (`src/screens/schedule/cellFits.js`) builds the engine input from the stored
Generated week exactly as `useGeneration.generate()` does (week catalog, priority resolution,
electives and events held), except that every placed activity is held, not only locked ones.

## Scope held

- Generated route only. The Manual route is the director's spreadsheet and is not second-guessed.
- Open and unfillable cells only. A filled cell's editor is unchanged.
- No placement priority, flag taxonomy or stored-data change.

## Known limit at close

Verified by unit and component tests (engine, helper, editor, both cell types, ScheduleScreen
suites) and the CI gate. Not yet exercised in `electron:dev` or the packaged app against a real
camp's week — the owner will confirm in the installed app before this is flipped to `completed`.
