import { useEffect, useMemo, useState } from 'react'
import { S, useEnterTransition } from '../../styles/shared'
import ModalCard from '../ModalCard'
import { seasonFairness, DEFAULT_MIN_SPREAD } from '../../engine/fairness'

// Season fairness: for each division, how many times each group had each activity across the weeks
// built so far, with the activities split unevenly (a group had it 3+ times more than another) on top.
// Reads every week's saved schedule itself, so it covers weeks other than the one on screen.
export default function FairnessPanel({ repo, weeks, groups, tiers, activities, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(false)
  const [tierId, setTierId] = useState(null)
  const enter = useEnterTransition('fade')

  useEffect(() => {
    let live = true
    repo.loadTemplateData()
      .then((d) => { if (live) setData(d) })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [repo])

  const report = useMemo(() => {
    if (!data) return null
    return seasonFairness({ weeks, templates: data.templates, slots: data.slots, groups, tiers, activities })
  }, [data, weeks, groups, tiers, activities])

  const tier = report?.tiers.find((t) => t.tierId === tierId) ?? report?.tiers[0] ?? null
  const weekNames = report ? report.weeks.map((w, i) => w.name || `Week ${i + 1}`) : []

  return (
    <div style={{ ...S.overlay, ...enter }}>
      <ModalCard onCancel={onClose} style={cardStyle} aria-labelledby="fairness-title">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
          <h3 id="fairness-title" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Season fairness</h3>
          <button data-autofocus className="press-97" onClick={onClose} style={{ ...S.btnSecondary, marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}>Close</button>
        </div>
        {error && <p style={{ fontSize: 13, color: 'var(--danger)' }}>Couldn't read the saved schedules.</p>}
        {!error && !report && <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Loading…</p>}
        {report && report.tiers.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>No weeks to count yet. Build a week and its activities will appear here.</p>
        )}
        {report && tier && (
          <>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)' }}>
              Counted {weekNames.length} {weekNames.length === 1 ? 'week' : 'weeks'}: {weekNames.join(', ')}. An activity is flagged when
              one group had it {report.minSpread} or more times more than another group in the same division.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
              <label style={{ fontSize: 13 }}>
                Division{' '}
                <select aria-label="Division" value={tier.tierId} onChange={(e) => setTierId(e.target.value)} style={{ ...S.input, width: 'auto', display: 'inline-block' }}>
                  {report.tiers.map((t) => <option key={t.tierId} value={t.tierId}>{t.name}{t.flaggedCount ? ` — ${t.flaggedCount} uneven` : ''}</option>)}
                </select>
              </label>
              <span style={{ fontSize: 13, fontWeight: 600, color: tier.flaggedCount ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {tier.flaggedCount
                  ? `${tier.flaggedCount} ${tier.flaggedCount === 1 ? 'activity is' : 'activities are'} split unevenly`
                  : 'No activity is split unevenly'}
              </span>
            </div>
            <div style={{ overflow: 'auto', maxHeight: '48vh', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0 }}>Activity</th>
                    {tier.groups.map((g) => <th key={g.id} style={th}>{g.name}</th>)}
                    <th style={th}>Most vs least</th>
                  </tr>
                </thead>
                <tbody>
                  {tier.rows.map((r) => (
                    <tr key={r.activityId} style={r.flagged ? { background: 'color-mix(in srgb, var(--accent) 10%, var(--surface))' } : undefined}>
                      <td style={{ ...td, textAlign: 'left', fontWeight: r.flagged ? 700 : 400, position: 'sticky', left: 0, background: r.flagged ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface)' }}>{r.name}</td>
                      {r.counts.map((n, i) => (
                        <td key={tier.groups[i].id} style={{ ...td, color: n === null ? 'var(--text-secondary)' : 'var(--text)', fontWeight: r.flagged && (n === r.max || n === r.min) ? 700 : 400 }}>
                          {n === null ? '–' : n}
                        </td>
                      ))}
                      <td style={{ ...td, fontWeight: r.flagged ? 700 : 400, color: r.flagged ? 'var(--accent)' : 'var(--text-secondary)' }}>{r.max} vs {r.min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details style={{ marginTop: 12, fontSize: 12 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Not had yet, by group</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18, color: 'var(--text-secondary)' }}>
                {tier.groups.map((g) => (
                  <li key={g.id}>
                    <strong style={{ color: 'var(--text)' }}>{g.name}</strong> ({g.total} sessions, {g.distinct} different activities):{' '}
                    {g.missing.length ? g.missing.join(', ') : 'has had everything this division has had'}
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </ModalCard>
    </div>
  )
}

const cardStyle = {
  background: 'var(--surface)', borderRadius: 12, padding: '20px 24px',
  maxWidth: 900, width: '92%', maxHeight: '88vh', overflow: 'auto',
  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
}
const th = { padding: '6px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0, textAlign: 'center', whiteSpace: 'nowrap' }
const td = { padding: '4px 8px', borderBottom: '1px solid var(--border)', textAlign: 'center' }

export { DEFAULT_MIN_SPREAD }
