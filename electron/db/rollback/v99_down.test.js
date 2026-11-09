// rollbackV99 drops activities.allowed_periods and activities.rotate_every_weeks and nothing else.
import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { openLocalDb, getSchemaVersion } from '../localDb.js'
import { rollbackV99 } from './v99_down.js'

const files = []
afterEach(() => {
  for (const f of files.splice(0)) {
    for (const s of ['', '-wal', '-shm']) if (fs.existsSync(f + s)) fs.unlinkSync(f + s)
  }
})
const cols = (db) => db.prepare('PRAGMA table_info(activities)').all().map((c) => c.name)

describe('rollbackV99', () => {
  it('drops both columns, keeps the activity, reports what was discarded, clears version >= 99, and is idempotent', () => {
    const file = path.join(os.tmpdir(), `shoresh-v99-down-${Date.now()}-${Math.random()}.sqlite`)
    files.push(file)
    const db = openLocalDb(file)
    db.prepare("INSERT INTO camps (id, name, signing_secret) VALUES ('c', 'Camp', ?)").run('a'.repeat(64))
    db.prepare(
      "INSERT INTO activities (id, camp_id, name, allowed_periods, rotate_every_weeks) VALUES ('a', 'c', 'Boating', ?, 2)"
    ).run('{"t1":["d1|b1"]}')
    expect(cols(db)).toEqual(expect.arrayContaining(['allowed_periods', 'rotate_every_weeks']))
    expect(rollbackV99(db).discarded).toEqual({ periods: 1, rotations: 1 })
    expect(cols(db)).not.toContain('allowed_periods')
    expect(cols(db)).not.toContain('rotate_every_weeks')
    expect(db.prepare('SELECT name FROM activities WHERE id = ?').get('a').name).toBe('Boating')
    expect(getSchemaVersion(db)).toBe(98)
    expect(rollbackV99(db).discarded).toEqual({ periods: 0, rotations: 0 })
    db.close()
  })
})
