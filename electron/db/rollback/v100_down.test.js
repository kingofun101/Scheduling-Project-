// rollbackV100 drops activities.spread_group and activities.spread_max_per_day and nothing else.
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openLocalDb, getSchemaVersion } from '../localDb.js'
import { rollbackV100 } from './v100_down.js'

const files = []
afterEach(() => {
  for (const f of files.splice(0)) {
    for (const s of ['', '-wal', '-shm']) if (fs.existsSync(f + s)) fs.unlinkSync(f + s)
  }
})
const cols = (db) => db.prepare('PRAGMA table_info(activities)').all().map((c) => c.name)

describe('rollbackV100', () => {
  it('drops both columns, keeps the activity, reports what was discarded, clears version >= 100, and is idempotent', () => {
    const file = path.join(os.tmpdir(), `shoresh-v100-down-${Date.now()}-${Math.random()}.sqlite`)
    files.push(file)
    const db = openLocalDb(file)
    db.prepare("INSERT INTO camps (id, name, signing_secret) VALUES ('c', 'Camp', ?)").run('a'.repeat(64))
    db.prepare(
      "INSERT INTO activities (id, camp_id, name, spread_group, spread_max_per_day) VALUES ('a', 'c', 'Archery', ?, 2)"
    ).run('Sports')
    expect(cols(db)).toEqual(expect.arrayContaining(['spread_group', 'spread_max_per_day']))
    expect(rollbackV100(db).discarded).toEqual({ groups: 1, limits: 1 })
    expect(cols(db)).not.toContain('spread_group')
    expect(cols(db)).not.toContain('spread_max_per_day')
    expect(db.prepare('SELECT name FROM activities WHERE id = ?').get('a').name).toBe('Archery')
    expect(getSchemaVersion(db)).toBe(99)
    expect(rollbackV100(db).discarded).toEqual({ groups: 0, limits: 0 })
    db.close()
  })
})
