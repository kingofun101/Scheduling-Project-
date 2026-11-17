// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import FairnessPanel from './FairnessPanel'

const weeks = [{ id: 'w1', name: 'Week 1', sort_order: 0 }, { id: 'w2', name: 'Week 2', sort_order: 1 }]
const tiers = [{ id: 'T', name: 'Geza' }]
const groups = [{ id: 'g1', name: 'Geza 1', tier_id: 'T' }, { id: 'g2', name: 'Geza 2', tier_id: 'T' }]
const activities = [{ id: 'kick', name: 'Kickball', eligible_tier_ids: [], eligible_group_ids: [] }, { id: 'arts', name: 'Arts', eligible_tier_ids: [], eligible_group_ids: [] }]
const templates = [{ id: 't1', week_id: 'w1', kind: 'generated' }, { id: 't2', week_id: 'w2', kind: 'generated' }]
const slot = (t, g, a) => ({ template_id: t, group_id: g, activity_id: a })
const slots = [slot('t1', 'g1', 'kick'), slot('t1', 'g1', 'kick'), slot('t2', 'g1', 'kick'), slot('t2', 'g1', 'kick'), slot('t1', 'g2', 'kick'), slot('t1', 'g1', 'arts'), slot('t1', 'g2', 'arts')]

describe('FairnessPanel', () => {
  it('shows counts per group and flags an uneven activity', async () => {
    const repo = { loadTemplateData: vi.fn().mockResolvedValue({ templates, slots, snapshots: [] }) }
    render(<FairnessPanel repo={repo} weeks={weeks} groups={groups} tiers={tiers} activities={activities} onClose={() => {}} />)
    await waitFor(() => expect(screen.getByText('1 activity is split unevenly')).toBeTruthy())
    expect(screen.getByText('4 vs 1')).toBeTruthy()
    expect(screen.getByText('Kickball')).toBeTruthy()
    expect(screen.getByText(/Counted 2 weeks: Week 1, Week 2/)).toBeTruthy()
  })
  it('says so when nothing is built yet, and closes', async () => {
    const onClose = vi.fn()
    const repo = { loadTemplateData: vi.fn().mockResolvedValue({ templates: [], slots: [], snapshots: [] }) }
    render(<FairnessPanel repo={repo} weeks={weeks} groups={groups} tiers={tiers} activities={activities} onClose={onClose} />)
    await waitFor(() => expect(screen.getByText(/No weeks to count yet/)).toBeTruthy())
    fireEvent.click(screen.getByText('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
