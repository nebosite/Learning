import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { canonicalRecordKey } from '../shared/records'
import { Grid } from './grid'

function rec(partial: Partial<OriginalTransaction>, ignored = false): TransactionRecord {
  const original: OriginalTransaction = {
    date: '2026-05-08',
    merchant: '',
    category: '',
    account: 'Chase',
    originalStatement: '',
    notes: '',
    amount: -1,
    tags: '',
    owner: '',
    ...partial,
  }
  return { key: canonicalRecordKey(original), original, overrides: {}, ignored }
}

function commonProps() {
  return {
    categories: [],
    active: true,
    resortKey: 0,
    onSetField: vi.fn(),
    onRemoveOverride: vi.fn(),
    onToggleIgnored: vi.fn(),
    onDelete: vi.fn(),
    onFill: vi.fn(),
  }
}

describe('Grid', () => {
  it('renders each record', () => {
    render(
      <Grid
        {...commonProps()}
        records={[rec({ merchant: 'Netflix' }), rec({ merchant: 'Hulu' })]}
      />,
    )
    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.getByText('Hulu')).toBeInTheDocument()
  })

  it('clicking a cell opens an inline editor with the current value', async () => {
    const user = userEvent.setup()
    render(
      <Grid {...commonProps()} records={[rec({ merchant: 'Netflix' })]} />,
    )

    await user.click(screen.getByText('Netflix'))
    const input = screen.getByDisplayValue('Netflix')
    expect(input).toBeInTheDocument()
    expect(input.tagName).toBe('INPUT')
  })

  it('Enter commits the edit, calls onSetField, and advances to the next row', async () => {
    const user = userEvent.setup()
    const props = commonProps()
    render(
      <Grid
        {...props}
        records={[
          rec({ merchant: 'Netflix' }),
          rec({ merchant: 'Hulu' }),
        ]}
      />,
    )

    await user.click(screen.getByText('Netflix'))
    const input = screen.getByDisplayValue('Netflix')
    await user.clear(input)
    await user.type(input, 'Disney+')
    await user.keyboard('{Enter}')

    expect(props.onSetField).toHaveBeenCalledWith(0, 'merchant', 'Disney+')
    // Editor moved to the same column on the next row.
    expect(screen.getByDisplayValue('Hulu')).toBeInTheDocument()
  })

  it('Escape cancels without saving', async () => {
    const user = userEvent.setup()
    const props = commonProps()
    render(<Grid {...props} records={[rec({ merchant: 'Netflix' })]} />)

    await user.click(screen.getByText('Netflix'))
    const input = screen.getByDisplayValue('Netflix')
    await user.clear(input)
    await user.type(input, 'Disney+')
    await user.keyboard('{Escape}')

    expect(props.onSetField).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('Disney+')).not.toBeInTheDocument()
  })

  it('ArrowDown abandons the edit (no save) and moves the editor down a row', async () => {
    const user = userEvent.setup()
    const props = commonProps()
    render(
      <Grid
        {...props}
        records={[rec({ merchant: 'Netflix' }), rec({ merchant: 'Hulu' })]}
      />,
    )

    await user.click(screen.getByText('Netflix'))
    const input = screen.getByDisplayValue('Netflix')
    await user.clear(input)
    await user.type(input, 'Disney+')
    await user.keyboard('{ArrowDown}')

    expect(props.onSetField).not.toHaveBeenCalled()
    // Now editing Hulu's merchant cell.
    expect(screen.getByDisplayValue('Hulu')).toBeInTheDocument()
  })

  it('ArrowUp at the top row closes the editor without moving past the edge', async () => {
    const user = userEvent.setup()
    const props = commonProps()
    render(<Grid {...props} records={[rec({ merchant: 'Netflix' })]} />)

    await user.click(screen.getByText('Netflix'))
    expect(screen.getByDisplayValue('Netflix')).toBeInTheDocument()
    await user.keyboard('{ArrowUp}')

    expect(props.onSetField).not.toHaveBeenCalled()
    expect(screen.queryByDisplayValue('Netflix')).not.toBeInTheDocument()
  })

  it('rows whose key is in sessionAddedKeys render with the grid-row-added class', () => {
    const a = rec({ merchant: 'Netflix' })
    const b = rec({ merchant: 'Hulu' })
    const { container } = render(
      <Grid
        {...commonProps()}
        records={[a, b]}
        sessionAddedKeys={new Set([a.key])}
      />,
    )
    const aCell = container.querySelector('.grid-row-added')
    expect(aCell).not.toBeNull()
    expect(aCell?.textContent).toContain('Netflix')
    // Only one row is flagged — Hulu is pre-existing and stays unbolded.
    expect(container.querySelectorAll('.grid-row-added')).toHaveLength(1)
  })

  it('typing in the filter narrows the displayed rows', async () => {
    const user = userEvent.setup()
    render(
      <Grid
        {...commonProps()}
        records={[
          rec({ merchant: 'Netflix' }),
          rec({ merchant: 'Whole Foods' }),
          rec({ merchant: 'Hulu' }),
        ]}
      />,
    )

    expect(screen.getByText('Whole Foods')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Filter transactions'), 'flix')

    expect(screen.getByText('Netflix')).toBeInTheDocument()
    expect(screen.queryByText('Whole Foods')).not.toBeInTheDocument()
    expect(screen.queryByText('Hulu')).not.toBeInTheDocument()
  })
})
