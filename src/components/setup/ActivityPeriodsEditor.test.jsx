// @vitest-environment jsdom
import React, { useState, useEffect } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ActivityPeriodsEditor from './ActivityPeriodsEditor'

const tiers = [{ id: 'geza', name: 'Geza', cohort_id: null }, { id: 'other', name: 'Other', cohort_id: null }]
const days = [{ id: 'mon', label: 'Monday', sort_order: 0 }, { id: 'thu', label: 'Thursday', sort_order: 1 }]
const timeBlocks = [
  { id: 'b1', name: 'Period 1', sort_order: 0 },
  { id: 'b4', name: 'Period 4', sort_order: 1 },
  { id: 'flag', name: 'Flag', sort_order: 2, events_only: 1 },
]

function Harness({ initial = {}, onValue }) {
  const [value, setValue] = useState(initial)
  useEffect(() => { onValue(value) }, [value, onValue])
  return <ActivityPeriodsEditor tiers={tiers} days={days} timeBlocks={timeBlocks} value={value} onChange={setValue} />
}

// Records the latest value the harness reports, without mutating anything a component owns.
const recorder = () => { const box = { current: null }; return { get current() { return box.current }, set: (v) => { box.current = v } } }

describe('ActivityPeriodsEditor', () => {
  it('starts with every division on "any period" and no grid', () => {
    const spy = recorder()
    render(<Harness onValue={spy.set} />)
    expect(screen.getAllByText(/any period/)).toHaveLength(2)
    expect(screen.queryByLabelText('Geza Monday Period 1')).toBeNull()
  })

  it('limits a division, ticks Monday 1st and Thursday 4th, and leaves the other division alone', () => {
    const spy = recorder()
    render(<Harness onValue={spy.set} />)
    fireEvent.click(screen.getByLabelText('Only certain periods for Geza'))
    fireEvent.click(screen.getByLabelText('Geza Monday Period 1'))
    fireEvent.click(screen.getByLabelText('Geza Thursday Period 4'))
    expect(spy.current).toEqual({ geza: ['mon|b1', 'thu|b4'] })
    expect(screen.queryByLabelText('Other Monday Period 1')).toBeNull()
  })

  it('never offers an events-only block', () => {
    const spy = recorder()
    render(<Harness onValue={spy.set} initial={{ geza: [] }} />)
    expect(screen.queryByText('Flag')).toBeNull()
  })

  it('warns when a limited division has no period ticked, and removing the limit clears its entry', () => {
    const spy = recorder()
    render(<Harness onValue={spy.set} initial={{ geza: [] }} />)
    expect(screen.getByText(/will not be scheduled for Geza/)).not.toBeNull()
    fireEvent.click(screen.getByLabelText('Only certain periods for Geza'))
    expect(spy.current).toEqual({})
  })
})
