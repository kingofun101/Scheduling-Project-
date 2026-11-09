import React from 'react'
import { periodKey } from '../../engine/allowedPeriods.js'

// "Available periods" for one activity, per age division (schema v99, activities.allowed_periods).
//
// `value` is a plain object {tierId: [ "dayId|blockId", ... ]}; a division with no entry is
// unrestricted. Ticking "Only certain periods" for a division opens a days × periods grid for it;
// ticking cells restricts the activity to those cells for that division, every week. The grid shows
// the time blocks of the division's own cohort (a division with no cohort sees all of them).
// Pure presentation: the parent owns the state and serializes it with serializeAllowedPeriods.

const th = { padding: '4px 8px', fontSize: 12, fontWeight: 600, textAlign: 'center', color: 'var(--text-secondary)' }
const rowHead = { padding: '4px 8px', fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap' }

function blocksFor(tier, timeBlocks) {
  return (timeBlocks || [])
    .filter((b) => !b.events_only)
    .filter((b) => !tier.cohort_id || !b.cohort_id || b.cohort_id === tier.cohort_id)
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
}

export default function ActivityPeriodsEditor({ tiers, days, timeBlocks, value, onChange }) {
  const sortedDays = (days || []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

  if (!tiers.length) return <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No age divisions set up yet</span>
  if (!sortedDays.length || !(timeBlocks || []).length) {
    return <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Set up your days and time blocks first, then you can choose periods here.</span>
  }

  function setLimited(tierId, limited) {
    const next = { ...value }
    if (limited) next[tierId] = next[tierId] ?? []
    else delete next[tierId]
    onChange(next)
  }
  function toggleCell(tierId, key) {
    const cells = new Set(value[tierId] ?? [])
    if (cells.has(key)) cells.delete(key)
    else cells.add(key)
    onChange({ ...value, [tierId]: [...cells] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {tiers.map((tier) => {
        const limited = Object.prototype.hasOwnProperty.call(value, tier.id)
        const cells = new Set(value[tier.id] ?? [])
        const blocks = blocksFor(tier, timeBlocks)
        return (
          <div key={tier.id}>
            <label style={{ fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox" checked={limited} aria-label={`Only certain periods for ${tier.name}`}
                onChange={(e) => setLimited(tier.id, e.target.checked)}
              />
              <span><strong>{tier.name}</strong>: {limited ? 'only these periods' : 'any period'}</span>
            </label>
            {limited && (
              <div style={{ overflowX: 'auto', marginTop: 6, paddingLeft: 22 }}>
                <table style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th} />
                      {sortedDays.map((d) => <th key={d.id} style={th}>{String(d.label ?? '').slice(0, 3)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((b) => (
                      <tr key={b.id}>
                        <th scope="row" style={rowHead}>{b.name}</th>
                        {sortedDays.map((d) => {
                          const key = periodKey(d.id, b.id)
                          return (
                            <td key={d.id} style={{ textAlign: 'center', padding: '2px 8px' }}>
                              <input
                                type="checkbox" checked={cells.has(key)} onChange={() => toggleCell(tier.id, key)}
                                aria-label={`${tier.name} ${d.label} ${b.name}`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {cells.size === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--danger, #b3261e)', marginTop: 4 }}>
                    No periods ticked: this activity will not be scheduled for {tier.name}.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
