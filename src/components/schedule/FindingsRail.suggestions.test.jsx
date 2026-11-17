// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FindingsRail from './FindingsRail'

const row = { key: 'c1', kind: 'UNFILLABLE', severity: 'danger', reason: 'Place full', locator: 'Shoresh 7 · Monday · 5th', slotIds: ['c1'], groupId: 's7', detail: ['Place full: Kickball'] }
const suggestion = { targetActivityId: 'Kickball', slotId: 'c2', toActivityId: 'Nature', text: 'Give Geza 2 Nature instead of Soccer, then Shoresh 7 can have Kickball' }

describe('FindingsRail swap suggestions', () => {
  it('lists swaps for a stuck cell on request and applies the chosen one', () => {
    const onApply = vi.fn()
    const getSuggestions = vi.fn(() => [suggestion])
    render(<FindingsRail rows={[row]} onDismiss={() => {}} onClose={() => {}} getSuggestions={getSuggestions} onApplySuggestion={onApply} />)
    expect(getSuggestions).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Suggest swaps'))
    expect(screen.getByText(suggestion.text)).toBeTruthy()
    fireEvent.click(screen.getByText('Apply'))
    expect(onApply).toHaveBeenCalledWith(row, suggestion)
  })
  it('says so when no single swap frees the cell', () => {
    render(<FindingsRail rows={[row]} onDismiss={() => {}} onClose={() => {}} getSuggestions={() => []} onApplySuggestion={() => {}} />)
    fireEvent.click(screen.getByText('Suggest swaps'))
    expect(screen.getByText('No single swap frees this cell.')).toBeTruthy()
  })
  it('shows no swap button without a suggestion source, or on other kinds of finding', () => {
    const { rerender } = render(<FindingsRail rows={[row]} onDismiss={() => {}} onClose={() => {}} />)
    expect(screen.queryByText('Suggest swaps')).toBeNull()
    rerender(<FindingsRail rows={[{ ...row, kind: 'UNDERSERVED' }]} onDismiss={() => {}} onClose={() => {}} getSuggestions={() => []} />)
    expect(screen.queryByText('Suggest swaps')).toBeNull()
  })
})
