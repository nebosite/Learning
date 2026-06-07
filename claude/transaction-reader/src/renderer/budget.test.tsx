import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Budget, BudgetRow, TransactionRecord } from '../shared/types'
import { canonicalRecordKey } from '../shared/records'
import {
  BudgetView,
  addMonths,
  autofillBudget,
  budgetBottomLine,
  budgetCellStatus,
  deleteRow,
  fillRowRange,
  formatBudgetAmount,
  monthsForBudget,
  moveRow,
  recordsForBudgetCell,
  renameCategoryInBudget,
  rowRemaining,
  rowTotal,
  sectionGrandTotal,
  sectionMonthlyTotals,
  statusFromSum,
  updateBudgeted,
  updateCell,
  updateCellComment,
} from './budget'

function makeRow(category: string, amounts: number[] = new Array(12).fill(0)): BudgetRow {
  return { category, amounts }
}

function makeBudget(partial: Partial<Budget> = {}): Budget {
  return {
    name: 'B',
    startMonth: '2026-01',
    income: [],
    bills: [],
    discretionary: [],
    ...partial,
  }
}

/**
 * Build a `TransactionRecord` whose original.* gets the fields you pass and
 * sensible defaults for the rest. Tests can pass `ignored: true` to flag a
 * record as out-of-scope without needing an override.
 */
function makeRecord(partial: {
  date?: string
  category?: string
  amount?: number
  merchant?: string
  ignored?: boolean
}): TransactionRecord {
  const original = {
    date: partial.date ?? '2026-01-15',
    account: 'Checking',
    merchant: partial.merchant ?? 'Acme',
    category: partial.category ?? 'Food',
    amount: partial.amount ?? -10,
    originalStatement: '',
    notes: '',
    tags: '',
    owner: '',
  }
  return {
    key: canonicalRecordKey(original),
    original,
    overrides: {},
    ignored: partial.ignored ?? false,
  }
}

/** Default no-op props the embedded sub-grid needs but most tests don't care about. */
const subGridDefaults = {
  records: [] as TransactionRecord[],
  categories: [] as string[],
  active: true,
  resortKey: 0,
  onSetField: vi.fn(),
  onRemoveOverride: vi.fn(),
  onToggleIgnored: vi.fn(),
  onDelete: vi.fn(),
  onFill: vi.fn(),
}

describe('addMonths', () => {
  it('advances within a year', () => {
    expect(addMonths('2026-03', 4)).toBe('2026-07')
  })

  it('rolls past December into the next year', () => {
    expect(addMonths('2026-10', 5)).toBe('2027-03')
  })

  it('handles 0 (identity)', () => {
    expect(addMonths('2026-01', 0)).toBe('2026-01')
  })
})

describe('monthsForBudget', () => {
  it('returns 12 consecutive months starting at the given month', () => {
    expect(monthsForBudget('2026-01')).toEqual([
      '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
      '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
    ])
  })

  it('crosses the year boundary', () => {
    const months = monthsForBudget('2025-11')
    expect(months[0]).toBe('2025-11')
    expect(months[1]).toBe('2025-12')
    expect(months[2]).toBe('2026-01')
    expect(months[11]).toBe('2026-10')
    expect(months).toHaveLength(12)
  })
})

describe('rowTotal / section totals', () => {
  it('sums all 12 amounts of a row', () => {
    const row = makeRow('Food', [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0])
    expect(rowTotal(row)).toBe(60)
  })

  it('sums monthly totals across rows by month', () => {
    const rows = [
      makeRow('a', [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      makeRow('b', [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ]
    expect(sectionMonthlyTotals(rows)).toEqual([11, 22, 33, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('sums the section grand total', () => {
    const rows = [
      makeRow('a', [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      makeRow('b', [10, 20, 30, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ]
    expect(sectionGrandTotal(rows)).toBe(66)
  })
})

describe('moveRow', () => {
  it('reorders within a section', () => {
    const b = makeBudget({
      discretionary: [makeRow('a'), makeRow('b'), makeRow('c')],
    })
    const next = moveRow(b, { section: 'discretionary', index: 0 }, { section: 'discretionary', index: 2 })
    // Moving index 0 to "before index 2" with the same-section adjustment lands it between b and c.
    expect(next.discretionary.map((r) => r.category)).toEqual(['b', 'a', 'c'])
  })

  it('moves a row across sections at the end of the target', () => {
    const b = makeBudget({
      discretionary: [makeRow('Groceries')],
      bills: [makeRow('Rent')],
    })
    const next = moveRow(
      b,
      { section: 'discretionary', index: 0 },
      { section: 'bills', index: b.bills.length },
    )
    expect(next.discretionary).toEqual([])
    expect(next.bills.map((r) => r.category)).toEqual(['Rent', 'Groceries'])
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({ discretionary: [makeRow('a'), makeRow('b')] })
    const before = JSON.parse(JSON.stringify(b))
    moveRow(b, { section: 'discretionary', index: 0 }, { section: 'income', index: 0 })
    expect(b).toEqual(before)
  })
})

describe('deleteRow', () => {
  it('drops the targeted row from the section', () => {
    const b = makeBudget({
      discretionary: [makeRow('a'), makeRow('b'), makeRow('c')],
    })
    const next = deleteRow(b, 'discretionary', 1)
    expect(next.discretionary.map((r) => r.category)).toEqual(['a', 'c'])
  })

  it('leaves other sections untouched', () => {
    const b = makeBudget({
      income: [makeRow('Salary')],
      discretionary: [makeRow('Food')],
    })
    const next = deleteRow(b, 'discretionary', 0)
    expect(next.income.map((r) => r.category)).toEqual(['Salary'])
    expect(next.discretionary).toEqual([])
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({ discretionary: [makeRow('a'), makeRow('b')] })
    const before = JSON.parse(JSON.stringify(b))
    deleteRow(b, 'discretionary', 0)
    expect(b).toEqual(before)
  })
})

describe('renameCategoryInBudget', () => {
  it('renames a row in place when no other row has the target name', () => {
    const b = makeBudget({ discretionary: [makeRow('Food'), makeRow('Books')] })
    const next = renameCategoryInBudget(b, 'Food', 'Eating Out')
    expect(next.discretionary.map((r) => r.category)).toEqual(['Eating Out', 'Books'])
  })

  it('merges into the existing target row when the section already has it', () => {
    const b = makeBudget({
      bills: [
        makeRow('Rent', [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        makeRow('Housing', [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ],
    })
    const next = renameCategoryInBudget(b, 'Rent', 'Housing')
    // Target row "Housing" keeps its position and absorbs Rent's amounts;
    // the "Rent" row is gone.
    expect(next.bills.map((r) => r.category)).toEqual(['Housing'])
    expect(next.bills[0].amounts[0]).toBe(150)
  })

  it('matches case-insensitively but writes the new casing', () => {
    const b = makeBudget({ discretionary: [makeRow('food')] })
    const next = renameCategoryInBudget(b, 'Food', 'Eating')
    expect(next.discretionary.map((r) => r.category)).toEqual(['Eating'])
  })

  it('only touches the section where the source row lives', () => {
    const b = makeBudget({
      income: [makeRow('Salary')],
      discretionary: [makeRow('Food')],
    })
    const next = renameCategoryInBudget(b, 'Food', 'Eating')
    expect(next.income.map((r) => r.category)).toEqual(['Salary'])
    expect(next.discretionary.map((r) => r.category)).toEqual(['Eating'])
  })

  it('returns the same budget when nothing matches', () => {
    const b = makeBudget({ discretionary: [makeRow('Books')] })
    const next = renameCategoryInBudget(b, 'Food', 'Eating')
    expect(next.discretionary).toEqual([{ category: 'Books', amounts: new Array(12).fill(0) }])
  })
})

describe('updateBudgeted', () => {
  it('sets the per-row Budgeted cap', () => {
    const b = makeBudget({ discretionary: [makeRow('Food'), makeRow('Gas')] })
    const next = updateBudgeted(b, 'discretionary', 0, 1200)
    expect(next.discretionary[0].budgeted).toBe(1200)
    expect(next.discretionary[1].budgeted).toBeUndefined()
  })

  it('normalizes negatives and decimals to non-negative whole dollars', () => {
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    expect(updateBudgeted(b, 'discretionary', 0, -42.7).discretionary[0].budgeted).toBe(43)
    expect(updateBudgeted(b, 'discretionary', 0, 100.4).discretionary[0].budgeted).toBe(100)
    expect(updateBudgeted(b, 'discretionary', 0, -0.2).discretionary[0].budgeted).toBe(0)
  })

  it('returns the input budget unchanged when the row index is out of range', () => {
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    expect(updateBudgeted(b, 'discretionary', 5, 500)).toBe(b)
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    const before = JSON.parse(JSON.stringify(b))
    updateBudgeted(b, 'discretionary', 0, 1000)
    expect(b).toEqual(before)
  })
})

describe('budgetBottomLine', () => {
  it('returns 0 for an empty budget', () => {
    expect(budgetBottomLine(makeBudget())).toBe(0)
  })

  it('sums month cells across all three sections', () => {
    const b = makeBudget({
      income: [makeRow('Salary', new Array(12).fill(5000))], // +60000
      bills: [makeRow('Rent', new Array(12).fill(-1500))], // -18000
      discretionary: [makeRow('Food', new Array(12).fill(-200))], // -2400
    })
    // No budgeted caps → no positive Remaining contributions; Food's
    // remaining is -2400 (< 0) so excluded.
    expect(budgetBottomLine(b)).toBe(60000 - 18000 - 2400)
  })

  it('subtracts Discretionary Remaining when above zero, ignores negative Remaining', () => {
    const b = makeBudget({
      discretionary: [
        {
          // -300 month total + 1000 budgeted → remaining 700 (subtracted).
          category: 'Food',
          amounts: [-100, -100, -100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          budgeted: 1000,
        },
        {
          // -1200 + 1000 → remaining -200 (NOT subtracted again — the months
          // already pulled it down).
          category: 'Coffee',
          amounts: [-600, -600, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          budgeted: 1000,
        },
      ],
    })
    // sum months: -300 + -1200 = -1500. Subtract Food's positive remaining
    // (700) — Coffee's negative remaining is ignored. Total: -2200.
    expect(budgetBottomLine(b)).toBe(-2200)
  })

  it('does not count positive Remaining outside Discretionary (no Budgeted on Income/Bills)', () => {
    // Even if a Bills row carried budgeted, the helper only adds positive
    // Remaining from Discretionary. Guards against later schema slip-ups.
    const b = makeBudget({
      bills: [
        {
          category: 'Rent',
          amounts: new Array(12).fill(0),
          budgeted: 1000,
        },
      ],
    })
    expect(budgetBottomLine(b)).toBe(0)
  })
})

describe('rowRemaining', () => {
  it('returns budgeted plus the sum of all 12 month cells', () => {
    const row: BudgetRow = {
      category: 'Food',
      amounts: [-100, -100, -100, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      budgeted: 1000,
    }
    // 1000 + (-300) = 700.
    expect(rowRemaining(row)).toBe(700)
  })

  it('goes negative when spending exceeds budget', () => {
    const row: BudgetRow = {
      category: 'Food',
      amounts: [-600, -600, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      budgeted: 1000,
    }
    // 1000 + (-1200) = -200.
    expect(rowRemaining(row)).toBe(-200)
  })

  it('treats missing budgeted as 0', () => {
    const row: BudgetRow = {
      category: 'Food',
      amounts: [-50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    }
    expect(rowRemaining(row)).toBe(-50)
  })
})

describe('updateCellComment', () => {
  it('sets a comment on the targeted cell and leaves siblings empty', () => {
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    const next = updateCellComment(b, 'discretionary', 0, 2, 'Holidays')
    expect(next.discretionary[0].comments).toEqual([
      '', '', 'Holidays', '', '', '', '', '', '', '', '', '',
    ])
  })

  it('clears the field entirely once every month is empty', () => {
    const b = makeBudget({
      discretionary: [
        {
          category: 'Food',
          amounts: new Array<number>(12).fill(0),
          comments: ['', '', 'Holidays', '', '', '', '', '', '', '', '', ''],
        },
      ],
    })
    const cleared = updateCellComment(b, 'discretionary', 0, 2, '')
    expect(cleared.discretionary[0].comments).toBeUndefined()
  })

  it('keeps other months untouched when overwriting', () => {
    const b = makeBudget({
      discretionary: [
        {
          category: 'Food',
          amounts: new Array<number>(12).fill(0),
          comments: ['Jan-note', '', '', '', '', '', '', '', '', '', '', ''],
        },
      ],
    })
    const next = updateCellComment(b, 'discretionary', 0, 5, 'Jun-note')
    expect(next.discretionary[0].comments?.[0]).toBe('Jan-note')
    expect(next.discretionary[0].comments?.[5]).toBe('Jun-note')
  })

  it('returns the input budget unchanged when the value is the same', () => {
    const b = makeBudget({
      discretionary: [
        {
          category: 'Food',
          amounts: new Array<number>(12).fill(0),
          comments: ['existing', '', '', '', '', '', '', '', '', '', '', ''],
        },
      ],
    })
    expect(updateCellComment(b, 'discretionary', 0, 0, 'existing')).toBe(b)
  })

  it('returns the input budget unchanged when the row is out of range', () => {
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    expect(updateCellComment(b, 'discretionary', 5, 0, 'x')).toBe(b)
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    const before = JSON.parse(JSON.stringify(b))
    updateCellComment(b, 'discretionary', 0, 0, 'hello')
    expect(b).toEqual(before)
  })
})

describe('fillRowRange', () => {
  it('copies the source month value into every cell between source and target (exclusive of source)', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const next = fillRowRange(b, 'discretionary', 0, 0, 3)
    expect(next.discretionary[0].amounts).toEqual([
      50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
  })

  it('works when dragging backwards (target < source)', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 0])],
    })
    const next = fillRowRange(b, 'discretionary', 0, 7, 4)
    expect(next.discretionary[0].amounts).toEqual([
      0, 0, 0, 0, 7, 7, 7, 7, 0, 0, 0, 0,
    ])
  })

  it('overwrites existing non-zero target cells', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [10, 99, 99, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const next = fillRowRange(b, 'discretionary', 0, 0, 2)
    expect(next.discretionary[0].amounts.slice(0, 3)).toEqual([10, 10, 10])
  })

  it('no-ops when source and target are the same month', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [5, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    expect(fillRowRange(b, 'discretionary', 0, 1, 1)).toBe(b)
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const before = JSON.parse(JSON.stringify(b))
    fillRowRange(b, 'discretionary', 0, 0, 5)
    expect(b).toEqual(before)
  })

  it('leaves other rows untouched', () => {
    const b = makeBudget({
      discretionary: [
        makeRow('Food', [9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        makeRow('Gas', [3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0]),
      ],
    })
    const next = fillRowRange(b, 'discretionary', 0, 0, 3)
    expect(next.discretionary[1].amounts).toEqual(b.discretionary[1].amounts)
  })
})

describe('updateCell', () => {
  it('sets one cell and leaves siblings untouched', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const next = updateCell(b, 'discretionary', 0, 1, 99)
    expect(next.discretionary[0].amounts).toEqual([1, 99, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0])
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({
      discretionary: [makeRow('Food', [1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const before = JSON.parse(JSON.stringify(b))
    updateCell(b, 'discretionary', 0, 1, 99)
    expect(b).toEqual(before)
  })
})

describe('formatBudgetAmount', () => {
  it('rounds to whole dollars with no decimal', () => {
    expect(formatBudgetAmount(0)).toBe('$0')
    expect(formatBudgetAmount(10)).toBe('$10')
    expect(formatBudgetAmount(10.49)).toBe('$10')
    expect(formatBudgetAmount(10.5)).toBe('$11')
    expect(formatBudgetAmount(-23.4)).toBe('-$23')
    expect(formatBudgetAmount(-23.7)).toBe('-$24')
  })
})

describe('statusFromSum', () => {
  it("returns 'empty' only when the month has no records at all", () => {
    expect(statusFromSum(undefined, 100, false)).toBe('empty')
    expect(statusFromSum({ sum: 0, count: 0 }, 100, false)).toBe('empty')
  })

  it("returns 'on-target' when the month has records but this category has none", () => {
    // No matches but month has SOMETHING — nothing happened here, which is fine.
    expect(statusFromSum(undefined, 100, true)).toBe('on-target')
    expect(statusFromSum({ sum: 0, count: 0 }, 100, true)).toBe('on-target')
  })

  it("returns 'on-target' when |sum| is within $1 of |budget|", () => {
    expect(statusFromSum({ sum: -100, count: 1 }, 100, true)).toBe('on-target')
    expect(statusFromSum({ sum: -100.99, count: 2 }, 100, true)).toBe('on-target')
    expect(statusFromSum({ sum: -99.01, count: 1 }, 100, true)).toBe('on-target')
    // Exactly $1 over still counts as on-target (boundary is inclusive).
    expect(statusFromSum({ sum: -101, count: 1 }, 100, true)).toBe('on-target')
  })

  it("returns 'under' when |sum| is less than |budget| by more than $1", () => {
    expect(statusFromSum({ sum: -90, count: 1 }, 100, true)).toBe('under')
    // Income (positive sum) compared with positive budget.
    expect(statusFromSum({ sum: 4800, count: 1 }, 5000, true)).toBe('under')
  })

  it("returns 'over' when |sum| exceeds |budget| by more than $1", () => {
    expect(statusFromSum({ sum: -110, count: 1 }, 100, true)).toBe('over')
    expect(statusFromSum({ sum: 5200, count: 1 }, 5000, true)).toBe('over')
  })
})

describe('budgetCellStatus', () => {
  it("flags a category that spent within the budget as 'on-target'", () => {
    const b = makeBudget({
      startMonth: '2026-01',
      bills: [makeRow('Rent', [1500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const records = [makeRecord({ date: '2026-01-03', category: 'Rent', amount: -1500 })]
    expect(budgetCellStatus(records, b, 'bills', 0, 0)).toBe('on-target')
  })

  it("flags overspending as 'over' (compared on magnitudes)", () => {
    const b = makeBudget({
      bills: [makeRow('Rent', [1500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const records = [makeRecord({ date: '2026-01-03', category: 'Rent', amount: -1700 })]
    expect(budgetCellStatus(records, b, 'bills', 0, 0)).toBe('over')
  })

  it("flags underspending as 'under' (compared on magnitudes)", () => {
    const b = makeBudget({
      bills: [makeRow('Rent', [1500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const records = [makeRecord({ date: '2026-01-03', category: 'Rent', amount: -1000 })]
    expect(budgetCellStatus(records, b, 'bills', 0, 0)).toBe('under')
  })

  it("returns 'empty' when no records exist for the month at all", () => {
    const b = makeBudget({
      bills: [makeRow('Rent', [1500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    // Wrong month: cell 0 is 2026-01, only record is 2026-02. The 2026-01
    // cell has no records of any kind → empty.
    const records = [makeRecord({ date: '2026-02-03', category: 'Rent', amount: -1500 })]
    expect(budgetCellStatus(records, b, 'bills', 0, 0)).toBe('empty')
  })

  it("returns 'on-target' when the month has records but none in this category", () => {
    const b = makeBudget({
      bills: [makeRow('Rent', [1500, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    // The 2026-01 month has a Food record but no Rent — Rent cell is
    // on-target (nothing happened in this category, which is fine).
    const records = [makeRecord({ date: '2026-01-03', category: 'Food', amount: -25 })]
    expect(budgetCellStatus(records, b, 'bills', 0, 0)).toBe('on-target')
  })
})

describe('autofillBudget', () => {
  // Pin the spending window so the test isn't time-dependent. With now =
  // 2026-06-15 the window is 2025-06-01 → 2026-05-31 (12 complete months).
  const now = new Date(2026, 5, 15)

  it('fills zero cells of an existing row, leaving non-zero cells alone', () => {
    const b = makeBudget({
      startMonth: '2026-06',
      discretionary: [
        makeRow('Food', [
          0, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
      ],
    })
    // Three transactions in three different months under Food. The cell at
    // index 2 (which is Aug 2026 in this budget) already has 100, so it
    // should be left alone even though Aug 2025 has analysis data.
    const records = [
      // Jun 2025 → fills budget month 0 (Jun 2026)
      makeRecord({ date: '2025-06-10', category: 'Food', amount: -47.3 }),
      // Jul 2025 → fills budget month 1 (Jul 2026)
      makeRecord({ date: '2025-07-04', category: 'Food', amount: -25.5 }),
      // Aug 2025 → would fill budget month 2 (Aug 2026) — but it's non-zero.
      makeRecord({ date: '2025-08-04', category: 'Food', amount: -99 }),
    ]
    const next = autofillBudget(records, b, now)
    expect(next.discretionary[0].amounts).toEqual([
      -48, // Jun: -47.30 → magnitude-up → -48
      -26, // Jul: -25.50 → -26
      100, // Aug: preserved
      0, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
  })

  it('adds a brand-new category to Discretionary with rounded amounts', () => {
    const b = makeBudget({ startMonth: '2026-06' })
    const records = [
      makeRecord({ date: '2025-06-10', category: 'Coffee', amount: -12.3 }),
      makeRecord({ date: '2025-12-20', category: 'Coffee', amount: -8 }),
    ]
    const next = autofillBudget(records, b, now)
    expect(next.discretionary.map((r) => r.category)).toEqual(['Coffee'])
    // Budget months are Jun-2026..May-2027. Jun fills from Jun-2025 (-12.3 →
    // -13); Dec fills from Dec-2025 (-8 → -8).
    const row = next.discretionary[0]
    expect(row.amounts[0]).toBe(-13)
    expect(row.amounts[6]).toBe(-8) // Dec is budget month index 6
  })

  it('fills future months from past data when MM matches (year ignored)', () => {
    // Budget runs Mar 2026 → Feb 2027. Records are in 2025. Same-MM mapping
    // should still fill the 2026/2027 months.
    const b = makeBudget({
      startMonth: '2026-03',
      discretionary: [makeRow('Gas')],
    })
    const records = [
      makeRecord({ date: '2025-07-10', category: 'Gas', amount: -60 }),
      makeRecord({ date: '2025-12-10', category: 'Gas', amount: -90 }),
    ]
    const next = autofillBudget(records, b, now)
    const row = next.discretionary[0]
    // Budget months: 0=Mar26, 1=Apr26, 2=May26, 3=Jun26, 4=Jul26, ..., 9=Dec26
    expect(row.amounts[4]).toBe(-60) // Jul 2026 filled from Jul 2025
    expect(row.amounts[9]).toBe(-90) // Dec 2026 filled from Dec 2025
    // Months without analysis data stay at 0.
    expect(row.amounts[0]).toBe(0)
  })

  it('fills existing rows in any section (does not duplicate by adding to Discretionary)', () => {
    const b = makeBudget({
      startMonth: '2026-06',
      bills: [makeRow('Rent', [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    })
    const records = [
      makeRecord({ date: '2025-06-01', category: 'Rent', amount: -1500 }),
    ]
    const next = autofillBudget(records, b, now)
    // Stays in Bills — not duplicated into Discretionary.
    expect(next.discretionary).toEqual([])
    expect(next.bills[0].amounts[0]).toBe(-1500)
  })

  it("matches existing rows case-insensitively", () => {
    const b = makeBudget({
      startMonth: '2026-06',
      discretionary: [makeRow('food')],
    })
    const records = [
      makeRecord({ date: '2025-06-10', category: 'Food', amount: -20 }),
    ]
    const next = autofillBudget(records, b, now)
    expect(next.discretionary).toHaveLength(1)
    expect(next.discretionary[0].amounts[0]).toBe(-20)
  })

  it('ignores records flagged as ignored', () => {
    const b = makeBudget({ startMonth: '2026-06' })
    const records = [
      makeRecord({
        date: '2025-06-10',
        category: 'Food',
        amount: -20,
        ignored: true,
      }),
    ]
    const next = autofillBudget(records, b, now)
    expect(next.discretionary).toEqual([])
  })

  it('skips records outside the analysis window', () => {
    const b = makeBudget({ startMonth: '2026-06' })
    // 2024-06-10 is before the 2025-06-01 → 2026-05-31 window.
    const records = [
      makeRecord({ date: '2024-06-10', category: 'Food', amount: -20 }),
    ]
    const next = autofillBudget(records, b, now)
    expect(next.discretionary).toEqual([])
  })

  it('does not mutate the input budget', () => {
    const b = makeBudget({
      startMonth: '2026-06',
      discretionary: [makeRow('Food')],
    })
    const before = JSON.parse(JSON.stringify(b))
    const records = [
      makeRecord({ date: '2025-06-10', category: 'Food', amount: -20 }),
    ]
    autofillBudget(records, b, now)
    expect(b).toEqual(before)
  })

  it('sorts the Discretionary section alphabetically (case-insensitive) — existing rows and newly-added rows both end up in order', () => {
    const b = makeBudget({
      startMonth: '2026-06',
      discretionary: [makeRow('zoo'), makeRow('Apple'), makeRow('mango')],
    })
    // A record under a brand-new category should also land in the sorted
    // position, not appended at the end.
    const records = [
      makeRecord({ date: '2025-06-10', category: 'Banana', amount: -10 }),
    ]
    const next = autofillBudget(records, b, now)
    expect(next.discretionary.map((r) => r.category)).toEqual([
      'Apple', 'Banana', 'mango', 'zoo',
    ])
  })
})

describe('recordsForBudgetCell', () => {
  it('returns indices whose effective category and month match (case-insensitive)', () => {
    const records = [
      makeRecord({ date: '2026-02-10', category: 'Food', amount: -5 }),
      makeRecord({ date: '2026-02-20', category: 'food', amount: -7 }),
      makeRecord({ date: '2026-03-01', category: 'Food', amount: -9 }),
      makeRecord({ date: '2026-02-15', category: 'Rent', amount: -1000 }),
    ]
    const b = makeBudget({
      startMonth: '2026-01',
      discretionary: [makeRow('Food')],
    })
    // 2026-02 is monthIndex 1.
    expect(recordsForBudgetCell(records, b, 'discretionary', 0, 1)).toEqual([0, 1])
  })

  it('skips ignored records', () => {
    const records = [
      makeRecord({ date: '2026-01-05', category: 'Food', ignored: true }),
      makeRecord({ date: '2026-01-12', category: 'Food' }),
    ]
    const b = makeBudget({ discretionary: [makeRow('Food')] })
    expect(recordsForBudgetCell(records, b, 'discretionary', 0, 0)).toEqual([1])
  })

  it('returns [] for an out-of-bounds row or a blank category', () => {
    const b = makeBudget({ discretionary: [makeRow('  ')] })
    expect(recordsForBudgetCell([], b, 'discretionary', 0, 0)).toEqual([])
    expect(recordsForBudgetCell([], b, 'discretionary', 5, 0)).toEqual([])
  })
})

describe('BudgetView', () => {
  it('seeds a new budget with every available category in Discretionary', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn<(budgets: Budget[]) => void>()
    render(
      <BudgetView
        budgets={[]}
        availableCategories={['Food', 'Rent', 'Travel']}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.type(screen.getByLabelText('Name'), 'My Plan')
    // The Start month input is pre-filled by the component; we accept whatever
    // it chose and just submit.
    await user.click(screen.getByRole('button', { name: 'Create' }))

    expect(onChange).toHaveBeenCalledOnce()
    const created = onChange.mock.calls[0][0][0]
    expect(created.name).toBe('My Plan')
    expect(created.income).toEqual([])
    expect(created.bills).toEqual([])
    expect(created.discretionary.map((r) => r.category)).toEqual(['Food', 'Rent', 'Travel'])
    expect(created.discretionary[0].amounts).toEqual(new Array(12).fill(0))
  })

  it('rejects a duplicate name (case-insensitive)', async () => {
    const user = userEvent.setup()
    const existing: Budget = {
      name: 'Existing',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [],
    }
    render(
      <BudgetView
        budgets={[existing]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'New' }))
    await user.type(screen.getByLabelText('Name'), 'existing')

    expect(screen.getByText(/already exists/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled()
  })

  it('the delete button removes the row from this budget only', async () => {
    const user = userEvent.setup()
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [makeRow('Food'), makeRow('Rent')],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })

    const { rerender } = render(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Remove Food from this budget',
      }),
    )

    rerender(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    expect(current[0].discretionary.map((r) => r.category)).toEqual(['Rent'])
  })

  it('section "+ Add" button appends a new category row and notifies onAddCategory', async () => {
    const user = userEvent.setup()
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [makeRow('Food')],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })
    const onAddCategory = vi.fn<(name: string) => void>()

    const { rerender } = render(
      <BudgetView
        budgets={current}
        availableCategories={['Food']}
        onChange={onChange}
        onAddCategory={onAddCategory}
        {...subGridDefaults}
      />,
    )

    // Open the adder for Bills.
    await user.click(
      screen.getByRole('button', { name: 'Add category to Bills' }),
    )
    // The input is rendered with a placeholder rather than a label, so query
    // by placeholder.
    await user.type(screen.getByPlaceholderText('Category…'), 'Rent')
    await user.keyboard('{Enter}')

    rerender(
      <BudgetView
        budgets={current}
        availableCategories={['Food']}
        onChange={onChange}
        onAddCategory={onAddCategory}
        {...subGridDefaults}
      />,
    )

    expect(onAddCategory).toHaveBeenCalledWith('Rent')
    expect(current[0].bills.map((r) => r.category)).toEqual(['Rent'])
    expect(current[0].bills[0].amounts).toEqual(new Array(12).fill(0))
    // Discretionary untouched.
    expect(current[0].discretionary.map((r) => r.category)).toEqual(['Food'])
  })

  it('section adder skips appending a row when the category already exists in the budget (case-insensitive)', async () => {
    const user = userEvent.setup()
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [makeRow('Rent')],
      discretionary: [],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })
    const onAddCategory = vi.fn<(name: string) => void>()

    render(
      <BudgetView
        budgets={current}
        availableCategories={['Rent']}
        onChange={onChange}
        onAddCategory={onAddCategory}
        {...subGridDefaults}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Add category to Discretionary' }),
    )
    await user.type(screen.getByPlaceholderText('Category…'), 'rent')
    await user.keyboard('{Enter}')

    // onAddCategory is still called (App dedupes against the customs list).
    expect(onAddCategory).toHaveBeenCalledWith('Rent')
    // But the budget itself is unchanged — no duplicate row.
    expect(onChange).not.toHaveBeenCalled()
  })

  it('jump buttons move a category to the named section, appended', async () => {
    const user = userEvent.setup()
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [makeRow('Rent')],
      discretionary: [makeRow('Food')],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })

    const { rerender } = render(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    // Find the Food row's "B"(ills) jump button via its aria-label.
    const moveFoodToBills = screen.getByRole('button', {
      name: 'Move Food to Bills',
    })
    await user.click(moveFoodToBills)

    // After onChange, render with the new state.
    rerender(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    const updated = current[0]
    expect(updated.discretionary).toEqual([])
    expect(updated.bills.map((r) => r.category)).toEqual(['Rent', 'Food'])
  })

  it('renders the Bottom line bar with the budgetBottomLine value', () => {
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [makeRow('Salary', new Array(12).fill(1000))], // +12000
      bills: [makeRow('Rent', new Array(12).fill(-500))], // -6000
      discretionary: [
        {
          category: 'Food',
          amounts: [-100, -100, -100, 0, 0, 0, 0, 0, 0, 0, 0, 0], // -300
          budgeted: 500, // remaining 200 (positive → counted)
        },
      ],
    }
    const { container } = render(
      <BudgetView
        budgets={[b]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )
    // sum months: 12000 - 6000 - 300 = 5700. Subtract Food's positive
    // remaining (200) → 5500.
    const bar = container.querySelector('.budget-bottom-line') as HTMLElement
    expect(bar).not.toBeNull()
    expect(bar.textContent).toContain('Bottom line')
    expect(bar.textContent).toContain('$5500')
  })

  it('bolds non-zero Remaining cells via the budget-remaining-bold class', () => {
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [
        // remaining = 500 + 0 = 500 (non-zero → bold)
        {
          category: 'Food',
          amounts: new Array<number>(12).fill(0),
          budgeted: 500,
        },
        // remaining = 0 + 0 = 0 (zero → NOT bold)
        { category: 'Idle', amounts: new Array<number>(12).fill(0) },
      ],
    }
    const { container } = render(
      <BudgetView
        budgets={[b]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )
    const remainingCells = container.querySelectorAll('.budget-remaining-cell')
    // Per-row (×2) + section totals row = 3 Remaining cells.
    expect(remainingCells.length).toBe(3)
    // Food's row: bold. Idle's row: not bold.
    const boldCells = container.querySelectorAll(
      '.budget-remaining-cell.budget-remaining-bold',
    )
    // Food row + section total (500) bold; Idle row (0) is not.
    expect(boldCells.length).toBe(2)
  })

  it('hovering for 1500ms opens the comment popup; typing saves the comment and the icon appears', async () => {
    const user = userEvent.setup()
    const initial: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [makeRow('Food')],
    }
    let current = [initial]
    // Wrap BudgetView in a stateful harness so the parent re-renders on
    // each onChange — without that, the popup's controlled textarea keeps
    // reading a stale empty comment and only the last char survives.
    function Harness(): JSX.Element {
      const [budgets, setBudgets] = useState<Budget[]>([initial])
      return (
        <BudgetView
          budgets={budgets}
          availableCategories={[]}
          onChange={(next) => {
            setBudgets(next)
            current = next
          }}
          onAddCategory={vi.fn()}
          {...subGridDefaults}
        />
      )
    }
    const { container } = render(<Harness />)

    const cell = container.querySelector(
      '[data-budget-section="discretionary"][data-budget-row="0"][data-budget-month="0"]',
    ) as HTMLElement
    expect(cell).not.toBeNull()
    // No popup at first; no icon either.
    expect(container.querySelector('.budget-comment-popup')).toBeNull()
    expect(cell.classList.contains('budget-cell-has-comment')).toBe(false)

    // Fake timers only for the hover countdown, then restore so userEvent.type
    // can use real timers internally.
    vi.useFakeTimers()
    fireEvent.mouseEnter(cell)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    vi.useRealTimers()

    const popup = container.querySelector(
      '.budget-comment-popup',
    ) as HTMLElement
    expect(popup).not.toBeNull()
    // The popup opens in display mode — read-only paragraph, no textarea.
    expect(popup.querySelector('.budget-comment-display')).not.toBeNull()
    expect(popup.querySelector('textarea')).toBeNull()
    // Clicking the popup promotes it to edit mode.
    fireEvent.click(popup)
    const textarea = popup.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea.placeholder).toBe('Enter a comment here')
    // No Clear button yet — comment is empty.
    expect(popup.querySelector('.budget-comment-clear')).toBeNull()

    await user.type(textarea, 'Holiday spending')

    expect(current[0].discretionary[0].comments?.[0]).toBe('Holiday spending')

    // Harness has already re-rendered (it owns the budgets state). The icon
    // should be lit and the Clear button visible.
    const refreshedCell = container.querySelector(
      '[data-budget-section="discretionary"][data-budget-row="0"][data-budget-month="0"]',
    ) as HTMLElement
    expect(refreshedCell.classList.contains('budget-cell-has-comment')).toBe(true)
    expect(
      container.querySelector('.budget-comment-clear'),
    ).not.toBeNull()
  })

  it('the Clear button on the comment popup empties the cell comment', async () => {
    vi.useFakeTimers()
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [
        {
          category: 'Food',
          amounts: new Array<number>(12).fill(0),
          comments: ['Holidays', '', '', '', '', '', '', '', '', '', '', ''],
        },
      ],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })
    const { container } = render(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )
    const cell = container.querySelector(
      '[data-budget-section="discretionary"][data-budget-row="0"][data-budget-month="0"]',
    ) as HTMLElement
    fireEvent.mouseEnter(cell)
    // Wrap in act so the setState scheduled by the timer callback flushes.
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    vi.useRealTimers()
    // Popup opens in display mode; click promotes it so the Clear button
    // appears.
    const popup = container.querySelector(
      '.budget-comment-popup',
    ) as HTMLElement
    fireEvent.click(popup)
    const clearBtn = container.querySelector(
      '.budget-comment-clear',
    ) as HTMLButtonElement
    expect(clearBtn).not.toBeNull()
    fireEvent.click(clearBtn)
    expect(current[0].discretionary[0].comments).toBeUndefined()
  })

  it('the comment popup shows an over/under-budget line when spending differs from the cell value', () => {
    vi.useFakeTimers()
    // Food has $100 budgeted for the first month; -$150 of records came in
    // for "food" that same month → $50 over budget.
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [
        makeRow('Food', [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
      ],
    }
    const records: TransactionRecord[] = [
      makeRecord({ date: '2026-01-12', category: 'Food', amount: -150 }),
    ]
    const { container } = render(
      <BudgetView
        budgets={[b]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
        records={records}
      />,
    )
    const cell = container.querySelector(
      '[data-budget-section="discretionary"][data-budget-row="0"][data-budget-month="0"]',
    ) as HTMLElement
    fireEvent.mouseEnter(cell)
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    vi.useRealTimers()
    const overUnder = container.querySelector('.budget-comment-overunder')
    expect(overUnder).not.toBeNull()
    expect(overUnder?.textContent).toBe('Spending is $50 over budget.')
  })

  it('drag-copying a month cell horizontally fills the spanned cells with the source value', async () => {
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [makeRow('Food', [50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })

    const { container } = render(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    // Find the source (month 0) and target (month 3) cells via data attrs.
    const sourceCell = container.querySelector(
      '[data-budget-section="discretionary"][data-budget-row="0"][data-budget-month="0"]',
    ) as HTMLElement
    const targetCell = container.querySelector(
      '[data-budget-section="discretionary"][data-budget-row="0"][data-budget-month="3"]',
    ) as HTMLElement
    expect(sourceCell).not.toBeNull()
    expect(targetCell).not.toBeNull()

    // elementFromPoint is what the drag logic uses to map cursor → cell; jsdom
    // doesn't supply one, so stub it to return the target cell while the test
    // "moves" the cursor.
    const originalElementFromPoint = document.elementFromPoint
    document.elementFromPoint = (() => targetCell) as typeof document.elementFromPoint

    // fireEvent wraps in act(), so each dispatch is followed by an effect
    // flush — the window mousemove/mouseup listeners are wired up between
    // calls instead of all firing before the effect runs.
    const handle = sourceCell.querySelector(
      '.budget-fill-handle',
    ) as HTMLElement
    fireEvent.mouseDown(handle)
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 })
    fireEvent.mouseUp(window)

    document.elementFromPoint = originalElementFromPoint

    expect(onChange).toHaveBeenCalled()
    expect(current[0].discretionary[0].amounts).toEqual([
      50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0,
    ])
  })

  it('flags Remaining > Budgeted rows with the surplus class', () => {
    // +400 in net positive month cells with a 1000 budgeted → remaining 1400,
    // which is greater than the 1000 budgeted (e.g. refunds outweighed
    // spending). Expect green-bg / white-bold via the surplus class.
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [
        {
          category: 'Refunds',
          amounts: [400, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          budgeted: 1000,
        },
      ],
    }
    const { container } = render(
      <BudgetView
        budgets={[b]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )
    const surplus = container.querySelector('.budget-remaining-surplus')
    expect(surplus).not.toBeNull()
    expect(surplus?.textContent).toBe('$1400')
  })

  it('renders Remaining and Budgeted columns; flags overspent rows with the alert class', () => {
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [
        {
          category: 'Coffee',
          // -1200 total spend; budgeted 1000 → remaining = -200 (< -1 → alert).
          amounts: [-600, -600, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          budgeted: 1000,
        },
      ],
    }
    const { container } = render(
      <BudgetView
        budgets={[b]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
      />,
    )

    expect(screen.getByText('Remaining')).toBeInTheDocument()
    expect(screen.getByText('Budgeted')).toBeInTheDocument()

    // The Coffee row's Remaining cell should carry the overspent class.
    const overspent = container.querySelector('.budget-remaining-overspent')
    expect(overspent).not.toBeNull()
    expect(overspent?.textContent).toBe('-$200')
  })

  it("clicking Autofill fills zero cells and registers brand-new categories with onAddCategory", async () => {
    const user = userEvent.setup()
    // Build a budget that starts in the same month as the records below so
    // the autofill mapping is straightforward.
    const startMonth = new Date().toISOString().slice(0, 7)
    const b: Budget = {
      name: 'B',
      startMonth,
      income: [],
      bills: [],
      discretionary: [makeRow('Food')],
    }
    let current = [b]
    const onChange = vi.fn<(next: Budget[]) => void>((next) => {
      current = next
    })
    const onAddCategory = vi.fn<(name: string) => void>()

    // Records: a Food entry in the budget's start month (one year earlier so
    // it falls within the default 12-month analysis window), plus a
    // brand-new "Coffee" category to ensure auto-add fires.
    const [yStr, mStr] = startMonth.split('-')
    const prevYear = String(Number(yStr) - 1)
    const records: TransactionRecord[] = [
      makeRecord({
        date: `${prevYear}-${mStr}-15`,
        category: 'Food',
        amount: -42.1,
      }),
      makeRecord({
        date: `${prevYear}-${mStr}-20`,
        category: 'Coffee',
        amount: -10,
      }),
    ]

    render(
      <BudgetView
        budgets={current}
        availableCategories={[]}
        onChange={onChange}
        onAddCategory={onAddCategory}
        {...subGridDefaults}
        records={records}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Autofill' }))

    expect(onChange).toHaveBeenCalledOnce()
    const updated = current[0]
    // Food row's first month is filled with -43 (magnitude-up of -42.1).
    const foodRow = updated.discretionary.find((r) => r.category === 'Food')!
    expect(foodRow.amounts[0]).toBe(-43)
    // Coffee was novel → auto-added to Discretionary.
    const coffeeRow = updated.discretionary.find((r) => r.category === 'Coffee')
    expect(coffeeRow).toBeDefined()
    expect(coffeeRow!.amounts[0]).toBe(-10)
    // ...and Coffee was registered with onAddCategory (Food was not — it
    // was already in the budget).
    expect(onAddCategory).toHaveBeenCalledWith('Coffee')
    expect(onAddCategory).not.toHaveBeenCalledWith('Food')
  })

  it('clicking a budget cell shows the matching transactions below the budget', async () => {
    const user = userEvent.setup()
    const b: Budget = {
      name: 'B',
      startMonth: '2026-01',
      income: [],
      bills: [],
      discretionary: [makeRow('Food'), makeRow('Rent')],
    }
    // Two records in 2026-02 against "Food" — only these should show up; a
    // third "Rent" record in the same month proves we're filtering by category.
    const records: TransactionRecord[] = [
      makeRecord({ date: '2026-02-05', category: 'Food', merchant: 'Cafe' }),
      makeRecord({ date: '2026-02-19', category: 'Food', merchant: 'Diner' }),
      makeRecord({ date: '2026-02-10', category: 'Rent', merchant: 'Landlord' }),
    ]

    render(
      <BudgetView
        budgets={[b]}
        availableCategories={[]}
        onChange={vi.fn()}
        onAddCategory={vi.fn()}
        {...subGridDefaults}
        records={records}
      />,
    )

    // Before any click: hint copy is shown, no transactions visible.
    expect(
      screen.getByText(/Click a budget cell to show the transactions/i),
    ).toBeInTheDocument()
    expect(screen.queryByText('Cafe')).not.toBeInTheDocument()

    // The Food row's 2026-02 cell — every value cell renders as $0 here, so
    // pick by position: 2nd row of the discretionary section, 2nd month.
    // Querying by row category narrows to the Food row first.
    const foodRow = screen.getByText('Food').closest('tr')!
    const foodCells = within(foodRow).getAllByText('$0')
    // The row totals cell is a $0 too; first 12 cells are months.
    await user.click(foodCells[1]) // 2026-02

    // The two Food records show up in the sub-grid; Rent does not.
    expect(screen.getByText('Cafe')).toBeInTheDocument()
    expect(screen.getByText('Diner')).toBeInTheDocument()
    expect(screen.queryByText('Landlord')).not.toBeInTheDocument()

    // Section 3 total: sum of the two displayed amounts (-10 each = -$20.00).
    // Scoped via the .budget-total wrapper so we don't collide with the per-row
    // amount cells that also format as "-$10.00".
    const totalSection = document.querySelector('.budget-total') as HTMLElement
    expect(totalSection).not.toBeNull()
    expect(totalSection.textContent).toContain('Transactions total')
    expect(totalSection.textContent).toContain('-$20.00')
  })
})

// Silences the unused-binding warning when the helper is only used inside the
// test bodies above.
void within
