import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Budget, BudgetRow, BudgetSection } from '../shared/types'
import {
  BudgetView,
  addMonths,
  deleteRow,
  monthsForBudget,
  moveRow,
  renameCategoryInBudget,
  rowTotal,
  sectionGrandTotal,
  sectionMonthlyTotals,
  updateCell,
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
      />,
    )

    const updated = current[0]
    expect(updated.discretionary).toEqual([])
    expect(updated.bills.map((r) => r.category)).toEqual(['Rent', 'Food'])
  })
})

// Silences the unused-binding warning when the helper is only used inside the
// test bodies above.
void within
