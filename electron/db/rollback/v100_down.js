// Inverse of migration v100 (electron/db/localDb.js) — daily spread rules.
//
//   1. `ALTER TABLE activities DROP COLUMN spread_max_per_day` and `... DROP COLUMN spread_group`.
//      v100 added two nullable columns and touched nothing else, so the rollback is lossless elsewhere.
//   2. DATA LOSS: every activity loses its spread family and daily limit; they go back to
//      "no spread rule", which is how every activity behaved before v100.
//
// Usage:  node electron/db/rollback/v100_down.js <path-to-shoresh.sqlite>

import { assertHighestApplied } from './assertHighestApplied.js'

const hasColumn = (db, table, col) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)

/**
 * @returns {{ok:true, discarded:{groups:number, limits:number}}}
 */
export function rollbackV100(db) {
  const discarded = { groups: 0, limits: 0 }

  if (hasColumn(db, 'activities', 'spread_group')) {
    discarded.groups = db.prepare('SELECT COUNT(*) c FROM activities WHERE spread_group IS NOT NULL').get().c
    db.exec('ALTER TABLE activities DROP COLUMN spread_group')
  }
  if (hasColumn(db, 'activities', 'spread_max_per_day')) {
    discarded.limits = db.prepare('SELECT COUNT(*) c FROM activities WHERE spread_max_per_day IS NOT NULL').get().c
    db.exec('ALTER TABLE activities DROP COLUMN spread_max_per_day')
  }

  // `>= 100`, never `= 100` (bareEqualityRollback.guard.test.js's class).
  db.prepare('DELETE FROM schema_migrations WHERE version >= 100').run()

  return { ok: true, discarded }
}

if (process.argv[1] && process.argv[1].endsWith('v100_down.js')) {
  const file = process.argv[2]
  if (!file) {
    console.error('usage: node electron/db/rollback/v100_down.js <path-to-shoresh.sqlite>')
    process.exit(1)
  }
  const { default: Database } = await import('better-sqlite3')
  const db = new Database(file)
  db.pragma('foreign_keys = ON')
  assertHighestApplied(db, 100)
  const result = rollbackV100(db)
  db.close()
  console.log(
    `v100 rolled back: dropped activities.spread_group (${result.discarded.groups} activity setting(s) lost) and ` +
    `activities.spread_max_per_day (${result.discarded.limits} lost). ` +
    'This app build still declares schema version 100: reopening it re-adds the columns empty.'
  )
}
