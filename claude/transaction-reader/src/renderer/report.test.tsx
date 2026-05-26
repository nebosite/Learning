import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { Report, defaultSpendingWindow, monthsInWindow } from './report'

describe('defaultSpendingWindow', () => {
  it('returns exactly the twelve months ending with the previous month', () => {
    const w = defaultSpendingWindow(new Date(2026, 4, 15))
    expect(w).toEqual({ from: '2025-05-01', to: '2026-04-30' })
  })

  it('handles a January reference date: window is the previous calendar year', () => {
    const w = defaultSpendingWindow(new Date(2026, 0, 1))
    expect(w).toEqual({ from: '2025-01-01', to: '2025-12-31' })
  })

  it('handles a December reference date', () => {
    const w = defaultSpendingWindow(new Date(2026, 11, 31))
    expect(w).toEqual({ from: '2025-12-01', to: '2026-11-30' })
  })
})

describe('monthsInWindow', () => {
  it('enumerates the YYYY-MM month buckets between from and to inclusive', () => {
    expect(monthsInWindow({ from: '2025-05-01', to: '2026-04-30' })).toEqual([
      '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10',
      '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
    ])
  })

  it('returns one month when from and to are in the same month', () => {
    expect(monthsInWindow({ from: '2026-03-05', to: '2026-03-28' })).toEqual(['2026-03'])
  })
})

function rec(partial: Partial<OriginalTransaction>, ignored = false): TransactionRecord {
  const original: OriginalTransaction = {
    date: '2025-06-01',
    merchant: '',
    category: '',
    account: '',
    originalStatement: '',
    notes: '',
    amount: 0,
    tags: '',
    owner: '',
    ...partial,
  }
  return { key: JSON.stringify(original), original, overrides: {}, ignored }
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

/** Get the data row whose category header text exactly matches the given name. */
function categoryRow(name: string): HTMLElement {
  // The pivot table renders the category in a <th> inside the data row.
  const th = screen.getByText(name, { selector: 'th.report-rowhead' })
  const tr = th.closest('tr')
  if (!tr) throw new Error(`No row found for category "${name}"`)
  return tr
}

describe('Report component', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 15))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('excludes records dated outside the spending window from the pivot totals', () => {
    const inside = rec({ date: '2025-06-01', category: 'Food', merchant: 'M1', amount: -10 })
    const insideAgain = rec({ date: '2025-07-01', category: 'Food', merchant: 'M2', amount: -20 })
    const tooNew = rec({ date: '2026-05-10', category: 'Food', merchant: 'M3', amount: -999 })
    const tooOld = rec({ date: '2024-01-01', category: 'Food', merchant: 'M4', amount: -777 })

    render(<Report {...commonProps()} records={[inside, insideAgain, tooNew, tooOld]} />)

    // The Food row's row-total cell sums just the in-window records (-$30).
    const row = categoryRow('Food')
    const totalCell = row.querySelector('.report-total-cell')
    expect(totalCell?.textContent).toBe('-$30.00')
    // Out-of-window amounts never make it into the pivot anywhere on the page.
    expect(screen.queryByText('-$999.00')).not.toBeInTheDocument()
    expect(screen.queryByText('-$777.00')).not.toBeInTheDocument()
  })

  it('excludes ignored records', () => {
    const counted = rec({ date: '2025-06-01', category: 'Food', merchant: 'X', amount: -5 })
    const ignoredR = rec({ date: '2025-06-02', category: 'Food', merchant: 'Y', amount: -100 }, true)

    render(<Report {...commonProps()} records={[counted, ignoredR]} />)

    const row = categoryRow('Food')
    expect(row.querySelector('.report-total-cell')?.textContent).toBe('-$5.00')
    expect(screen.queryByText('-$100.00')).not.toBeInTheDocument()
  })

  it('always renders all 12 month columns, even with no data in some', () => {
    render(
      <Report
        {...commonProps()}
        records={[rec({ date: '2025-06-15', category: 'Food', merchant: 'X', amount: -5 })]}
      />,
    )
    expect(screen.getByRole('columnheader', { name: /May 2025/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Apr 2026/ })).toBeInTheDocument()
  })

  it('clicking a merchant checkbox narrows the pivot totals to that merchant', async () => {
    const r1 = rec({ date: '2025-06-01', category: 'Food', merchant: 'Keep', amount: -5 })
    const r2 = rec({ date: '2025-06-02', category: 'Food', merchant: 'Skip', amount: -50 })

    render(<Report {...commonProps()} records={[r1, r2]} />)
    // Before any selection both contribute: Food row total = -$55.
    expect(categoryRow('Food').querySelector('.report-total-cell')?.textContent).toBe('-$55.00')

    // user-event 14 uses setTimeout internally; switch to real timers for
    // the interaction now that the spending window has been captured.
    vi.useRealTimers()
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Keep' }))

    // After selecting only Keep, the Food row total is just Keep's -$5.
    expect(categoryRow('Food').querySelector('.report-total-cell')?.textContent).toBe('-$5.00')
  })
})

// Silences the unused-binding warning when the helper is only used inside test bodies.
void within
