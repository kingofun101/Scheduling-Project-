// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import CellInlineEditor from './CellInlineEditor'

const eligible = [
  { id: 'act-1', name: 'Swimming', priority: 'normal' },
  { id: 'act-2', name: 'Arts & Crafts', priority: 'normal' },
]

describe('CellInlineEditor', () => {
  it('typing filters the suggestion list to matching eligible activities', () => {
    render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={vi.fn()} onCreateNew={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'swi' } })
    expect(screen.getByText('Swimming')).toBeTruthy()
    expect(screen.queryByText('Arts & Crafts')).toBeNull()
  })

  it('Enter places the top match', () => {
    const onPlace = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={onPlace} onCreateNew={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'swi' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onPlace).toHaveBeenCalledWith('act-1')
  })

  it('no match offers "Create <name>" and Enter confirms it', () => {
    const onCreateNew = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={vi.fn()} onCreateNew={onCreateNew} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Kayaking' } })
    expect(screen.getByText(/Create.*Kayaking/)).toBeTruthy()
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onCreateNew).toHaveBeenCalledWith('Kayaking')
  })

  it('a name that collapses to an existing name (case/space-insensitive) is treated as a match, not create-new', () => {
    const onPlace = vi.fn()
    const onCreateNew = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={onPlace} onCreateNew={onCreateNew} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  swimming  ' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onPlace).toHaveBeenCalledWith('act-1')
    expect(onCreateNew).not.toHaveBeenCalled()
  })

  it('Escape cancels without placing or creating', () => {
    const onCancel = vi.fn()
    const onPlace = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={onPlace} onCreateNew={vi.fn()} onCancel={onCancel} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'swi' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
    expect(onPlace).not.toHaveBeenCalled()
  })

  it('blur with nothing typed cancels (empty no-op)', () => {
    const onCancel = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={vi.fn()} onCreateNew={vi.fn()} onCancel={onCancel} />)
    fireEvent.blur(screen.getByRole('textbox'))
    expect(onCancel).toHaveBeenCalled()
  })

  // T105 §1 — colon-delimiter grammar
  describe('elective authoring (colon grammar)', () => {
    it('a typed "name: member, member" commits via onCreateElective, parsed', () => {
      const onCreateElective = vi.fn()
      const onPlace = vi.fn()
      const onCreateNew = vi.fn()
      render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={onPlace} onCreateNew={onCreateNew} onCreateElective={onCreateElective} onCancel={vi.fn()} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Afternoon Chugim: Kayaking, Swimming' } })
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
      expect(onCreateElective).toHaveBeenCalledWith('Afternoon Chugim', ['Kayaking', 'Swimming'], 'Afternoon Chugim: Kayaking, Swimming')
      expect(onPlace).not.toHaveBeenCalled()
      expect(onCreateNew).not.toHaveBeenCalled()
    })

    it('shows a live chip preview while typing elective grammar, distinguishing known vs new members', () => {
      render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={vi.fn()} onCreateNew={vi.fn()} onCreateElective={vi.fn()} onCancel={vi.fn()} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Chugim: Swimming, Kayaking' } })
      expect(screen.getByText('Swimming')).toBeTruthy()
      expect(screen.getByText('Kayaking')).toBeTruthy()
    })

    it('exact-match-first guard: a colon-containing string that exactly matches an existing activity name places that activity, not an elective', () => {
      const withColonName = [...eligible, { id: 'act-3', name: 'Free Time: Cabin Choice', priority: 'normal' }]
      const onCreateElective = vi.fn()
      const onPlace = vi.fn()
      render(<CellInlineEditor eligibleActivities={withColonName} currentActivityName={null} onPlace={onPlace} onCreateNew={vi.fn()} onCreateElective={onCreateElective} onCancel={vi.fn()} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Free Time: Cabin Choice' } })
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
      expect(onPlace).toHaveBeenCalledWith('act-3')
      expect(onCreateElective).not.toHaveBeenCalled()
    })

    it('a colon with no set name (blank before the colon) does not commit an elective', () => {
      const onCreateElective = vi.fn()
      const onCreateNew = vi.fn()
      render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={vi.fn()} onCreateNew={onCreateNew} onCreateElective={onCreateElective} onCancel={vi.fn()} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: ': Swimming' } })
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
      expect(onCreateElective).not.toHaveBeenCalled()
    })

    // Code Reviewer LOW: an empty pre-colon set name must never fall through
    // to onCreateNew and mint an activity literally named ": Swimming".
    it('an empty set name never falls through to onCreateNew (no ": Swimming" activity)', () => {
      const onCreateNew = vi.fn()
      const onPlace = vi.fn()
      const onCancel = vi.fn()
      render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={onPlace} onCreateNew={onCreateNew} onCreateElective={vi.fn()} onCancel={onCancel} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: ': Swimming' } })
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
      expect(onCreateNew).not.toHaveBeenCalled()
      expect(onPlace).not.toHaveBeenCalled()
      // Nothing committed — Enter was a no-op, so blur still cancels (proves
      // the editor is still "open"/uncommitted, not silently accepted).
      fireEvent.blur(screen.getByRole('textbox'))
      expect(onCancel).toHaveBeenCalled()
    })

    it('same invalid-grammar guard applies with no onCreateElective wired at all (legacy caller)', () => {
      const onCreateNew = vi.fn()
      render(<CellInlineEditor eligibleActivities={eligible} currentActivityName={null} onPlace={vi.fn()} onCreateNew={onCreateNew} onCancel={vi.fn()} />)
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Chugim: Kayaking' } })
      fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
      // No onCreateElective prop means the colon grammar can't commit either
      // — must not silently degrade into onCreateNew('Chugim: Kayaking').
      expect(onCreateNew).not.toHaveBeenCalled()
    })
  })
})

describe('CellInlineEditor — audit-2 A9/A10: sets findable without typing, list as an unclipped popover', () => {
  const sets = [
    { id: 'es-1', name: 'Afternoon Chugim', is_reusable: 1 },
    { id: 'es-2', name: 'Chugim one-off', is_reusable: 0 },
  ]
  const renderEditor = (props = {}) => render(
    <div className="cell" style={{ overflow: 'hidden' }}>
      <CellInlineEditor eligibleActivities={eligible} electiveSets={sets} currentActivityName={null} onPlace={vi.fn()} onCreateNew={vi.fn()} onCreateElective={vi.fn()} onCancel={vi.fn()} {...props} />
    </div>
  )

  it('lists the reusable elective sets as soon as the editor opens, before anything is typed', () => {
    renderEditor()
    expect(screen.getByText('Afternoon Chugim').closest('.cell-inline-editor-suggestion')).toBeTruthy()
    expect(screen.queryByText('Chugim one-off')).toBeNull()
  })

  it('keeps the set visible when its full name is typed, so the match is seen before Enter', () => {
    renderEditor()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Afternoon Chugim' } })
    expect(screen.getByText('Afternoon Chugim').closest('.cell-inline-editor-suggestion')).toBeTruthy()
  })

  it('renders the suggestion list outside the cell, fixed-positioned, so the cell cannot clip it', () => {
    const { container } = renderEditor()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 's' } })
    const list = document.querySelector('.cell-inline-editor-suggestions')
    expect(list).toBeTruthy()
    expect(container.contains(list)).toBe(false)
    expect(list.style.position).toBe('fixed')
  })

  it('ArrowDown/ArrowUp move the highlight and Enter commits the highlighted option', () => {
    const onPlace = vi.fn()
    const onCreateElective = vi.fn()
    renderEditor({ onPlace, onCreateElective })
    const input = screen.getByRole('textbox')
    // "i" matches Swimming (activity) then Afternoon Chugim (set), in that order.
    fireEvent.change(input, { target: { value: 'i' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.querySelector('[aria-selected="true"]').textContent).toContain('Afternoon Chugim')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(document.querySelector('[aria-selected="true"]').textContent).toBe('Swimming')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreateElective).toHaveBeenCalledWith('Afternoon Chugim', [], 'Afternoon Chugim')
    expect(onPlace).not.toHaveBeenCalled()
  })
})

describe('CellInlineEditor — elective sets as suggestions (packaged audit #26)', () => {
  const sets = [
    { id: 'es-1', name: 'Afternoon Chugim', is_reusable: 1 },
    { id: 'es-2', name: 'Chugim one-off', is_reusable: 0 },
  ]

  it('lists a reusable elective set beside activities with an Elective tag, and picking it places it through the elective path', () => {
    const onCreateElective = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} electiveSets={sets} currentActivityName={null} onPlace={vi.fn()} onCreateNew={vi.fn()} onCreateElective={onCreateElective} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'chug' } })
    const row = screen.getByText('Afternoon Chugim').closest('.cell-inline-editor-suggestion')
    expect(row.textContent).toContain('Elective')
    expect(screen.queryByText('Chugim one-off')).toBeNull()
    fireEvent.mouseDown(row)
    expect(onCreateElective).toHaveBeenCalledWith('Afternoon Chugim', [], 'Afternoon Chugim')
  })

  it('Enter on an exact elective-set name places the set instead of minting an activity', () => {
    const onCreateElective = vi.fn()
    const onCreateNew = vi.fn()
    render(<CellInlineEditor eligibleActivities={eligible} electiveSets={sets} currentActivityName={null} onPlace={vi.fn()} onCreateNew={onCreateNew} onCreateElective={onCreateElective} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'afternoon chugim' } })
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })
    expect(onCreateElective).toHaveBeenCalledWith('Afternoon Chugim', [], 'Afternoon Chugim')
    expect(onCreateNew).not.toHaveBeenCalled()
  })
})

describe('CellInlineEditor — what fits here', () => {
  const sets = [{ id: 'es-1', name: 'Afternoon Chugim', is_reusable: 1 }]
  const fits = [
    { activityId: 'act-1', name: 'Swimming', note: 'Needs 1 more this week' },
    { activityId: 'act-2', name: 'Arts & Crafts', note: null },
  ]
  const renderEditor = (props = {}) => render(
    <CellInlineEditor eligibleActivities={eligible} electiveSets={sets} currentActivityName={null} onPlace={vi.fn()} onCreateNew={vi.fn()} onCreateElective={vi.fn()} onCancel={vi.fn()} {...props} />
  )
  const headings = () => [...document.querySelectorAll('.cell-inline-editor-suggestions-heading')].map(h => h.textContent)
  const rows = () => [...document.querySelectorAll('.cell-inline-editor-suggestion')].map(r => r.textContent)

  it('opens with what fits first, in the given order, with its note, then the elective sets', () => {
    renderEditor({ fits })
    expect(headings()).toEqual(['Fits here', 'Elective sets'])
    expect(rows()).toEqual(['SwimmingNeeds 1 more this week', 'Arts & Crafts', 'Afternoon ChugimElective'])
  })

  it('picking a fit places that activity through the normal place path', () => {
    const onPlace = vi.fn()
    renderEditor({ fits, onPlace })
    fireEvent.mouseDown(screen.getByText('Arts & Crafts').closest('.cell-inline-editor-suggestion'))
    expect(onPlace).toHaveBeenCalledWith('act-2')
  })

  it('Enter with the first fit highlighted places it', () => {
    const onPlace = vi.fn()
    renderEditor({ fits, onPlace })
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onPlace).toHaveBeenCalledWith('act-1')
  })

  it('says plainly when nothing fits, rather than showing an empty list', () => {
    renderEditor({ fits: [], electiveSets: [] })
    expect(headings()).toEqual(['Fits here'])
    expect(screen.getByText('Nothing fits here right now')).toBeTruthy()
    expect(rows()).toEqual([])
  })

  it('typing still searches every eligible activity, not only the fits', () => {
    renderEditor({ fits: [fits[1]] })
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'swi' } })
    expect(rows()).toEqual(['Swimming'])
    expect(headings()).toEqual([])
  })

  it('without a fits list (Manual route, filled cells) the editor opens exactly as before', () => {
    renderEditor()
    expect(headings()).toEqual(['Elective sets'])
    expect(screen.queryByText('Nothing fits here right now')).toBeNull()
  })
})
