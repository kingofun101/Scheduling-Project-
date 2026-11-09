// Inverse of migration v99 (electron/db/localDb.js) — activity periods + rotation.
//
//   1. `ALTER TABLE activities DROP COLUMN rotate_every_weeks` and `... DROP COLUMN allowed_periods`.
//      v99 added two nullable columns and touched nothing else, so the rollback is lossless elsewhere.
//   2. DATA LOSS: every activity loses its per-division allowed periods and its rotation setting; they
//      go back to "no limits", which is how every activity behaved before v99.
//
// Usage:  node electron/db/rollback/v99_down.js <path-to-shoresh.sqlite>

import { assertHighestApplied } from './assertHighestApplied.js'

const hasColumn = (db, table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)

/**
 * @returns {{ok:true, discarded:{periods:number, rotations:number}}}
 */
export function rollbackV99(db) {
  const discarded = { periods: 0, rotations: 0 }

  if (hasColumn(db, 'activities', 'allowed_periods')) {
    discarded.periods = db.prepare('SELECT COUNT(*) c FROM activities WHERE allowed_periods IS NOT NULL').get().c
    db.exec('ALTER TABLE activities DROP COLUMN allowed_periods')
  }
  if (hasColumn(db, 'activities', 'rotate_every_weeks')) {
    discarded.rotations = db.prepare('SELECT COUNT(*) c FROM activities WHERE rotate_every_weeks IS NOT NULL').get().c
    db.exec('ALTER TABLE activities DROP COLUMN rotate_every_weeks')
  }

  // `>= 99`, never `= 99` (bareEqualityRollback.guard.test.js's class).
  db.prepare('DELETE FROM schema_migrations WHERE version >= 99').run()

  return { ok: true, discarded }
}

if (process.argv[1] && process.argv[1].endsWith('v99_down.js')) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: node electron/db/rollback/v99_down.js <path-to-shoresh.sqlite>')
    process.exit(1)
  }
  const { default: Database } = await import('better-sqlite3')
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  assertHighestApplied(db, 99)
  const result = rollbackV99(db)
  db.close()
  console.log(
    `v99 rolled back: dropped activities.allowed_periods (${result.discarded.periods} activity setting(s) lost) and ` +
    `activities.rotate_every_weeks (${result.discarded.rotations} lost). ` +
    'This app build still declares schema version 99: reopening it re-adds the columns empty.'
  )
}
