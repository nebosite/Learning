import { useEffect, useMemo, useRef, useState } from 'react'
import type { Budget, BudgetRow, BudgetSection } from '../shared/types'
import { formatAmount } from './grid'
import './budget.css'

const SECTIONS: { id: BudgetSection; label: string }[] = [
  { id: 'income', label: 'Income' },
  { id: 'bills', label: 'Bills' },
  { id: 'discretionary', label: 'Discretionary' },
]

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number)
  const date = new Date(y, m - 1 + n, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthsForBudget(startMonth: string): string[] {
  return Array.from({ length: 12 }, (_, i) => addMonths(startMonth, i))
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[Number(m) - 1] ?? m} ${y.slice(2)}`
}

export function rowTotal(row: BudgetRow): number {
  return row.amounts.reduce((s, a) => s + a, 0)
}

export function sectionMonthlyTotals(rows: BudgetRow[]): number[] {
  const out = new Array<number>(12).fill(0)
  for (const r of rows) {
    for (let i = 0; i < 12; i++) out[i] += r.amounts[i] ?? 0
  }
  return out
}

export function sectionGrandTotal(rows: BudgetRow[]): number {
  let s = 0
  for (const r of rows) for (const a of r.amounts) s += a
  return s
}

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export interface DragSource {
  section: BudgetSection
  index: number
}

export function moveRow(
  budget: Budget,
  src: DragSource,
  target: { section: BudgetSection; index: number },
): Budget {
  const next: Budget = {
    ...budget,
    income: [...budget.income],
    bills: [...budget.bills],
    discretionary: [...budget.discretionary],
  }
  const [moved] = next[src.section].splice(src.index, 1)
  let ti = target.index
  if (src.section === target.section && src.index < target.index) ti--
  next[target.section].splice(ti, 0, moved)
  return next
}

export function updateCell(
  budget: Budget,
  section: BudgetSection,
  rowIdx: number,
  monthIdx: number,
  value: number,
): Budget {
  const next: Budget = { ...budget, [section]: [...budget[section]] }
  const rows = next[section]
  const row = rows[rowIdx]
  const amounts = row.amounts.slice()
  amounts[monthIdx] = value
  rows[rowIdx] = { ...row, amounts }
  return next
}

interface BudgetProps {
  budgets: Budget[]
  /** Distinct category names available when seeding a new budget. */
  availableCategories: string[]
  onChange: (budgets: Budget[]) => void
}

export function BudgetView({
  budgets,
  availableCategories,
  onChange,
}: BudgetProps): JSX.Element {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [drag, setDrag] = useState<DragSource | null>(null)
  const [editing, setEditing] = useState<{
    section: BudgetSection
    row: number
    month: number
  } | null>(null)

  // If no budget is explicitly selected (or the selected one was removed),
  // fall back to the first available budget.
  const selected = useMemo<Budget | null>(() => {
    if (selectedName) {
      const found = budgets.find((b) => b.name === selectedName)
      if (found) return found
    }
    return budgets[0] ?? null
  }, [budgets, selectedName])

  function applyToSelected(updater: (b: Budget) => Budget): void {
    if (!selected) return
    onChange(budgets.map((b) => (b.name === selected.name ? updater(b) : b)))
  }

  function handleCreate(name: string, startMonth: string): void {
    const rows: BudgetRow[] = availableCategories.map((category) => ({
      category,
      amounts: new Array<number>(12).fill(0),
    }))
    const next: Budget = {
      name,
      startMonth,
      income: [],
      bills: [],
      discretionary: rows,
    }
    onChange([...budgets, next])
    setSelectedName(name)
    setNewOpen(false)
  }

  return (
    <div className="budget-panel">
      <div className="budget-toolbar">
        <label className="budget-select-label">
          Budget:
          <select
            value={selected?.name ?? ''}
            onChange={(e) => setSelectedName(e.target.value)}
            disabled={budgets.length === 0}
          >
            {budgets.length === 0 ? (
              <option value="">(no budgets — click New)</option>
            ) : (
              budgets.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))
            )}
          </select>
        </label>
        <button type="button" onClick={() => setNewOpen(true)}>
          New
        </button>
        {selected && (
          <span className="budget-range">
            {formatMonth(selected.startMonth)} —{' '}
            {formatMonth(addMonths(selected.startMonth, 11))}
          </span>
        )}
      </div>

      {selected ? (
        <BudgetGrid
          budget={selected}
          drag={drag}
          editing={editing}
          onStartEdit={(section, row, month) => setEditing({ section, row, month })}
          onCancelEdit={() => setEditing(null)}
          onCommitEdit={(section, row, month, value) => {
            applyToSelected((b) => updateCell(b, section, row, month, value))
            setEditing(null)
          }}
          onDragStart={(section, index) => setDrag({ section, index })}
          onDragEnd={() => setDrag(null)}
          onDrop={(target) => {
            if (drag) applyToSelected((b) => moveRow(b, drag, target))
            setDrag(null)
          }}
          onJumpSection={(from, index, to) => {
            applyToSelected((b) =>
              moveRow(
                b,
                { section: from, index },
                { section: to, index: b[to].length },
              ),
            )
          }}
        />
      ) : (
        <p className="budget-empty">No budget selected. Click New to create one.</p>
      )}

      {newOpen && (
        <NewBudgetModal
          existingNames={budgets.map((b) => b.name)}
          onCancel={() => setNewOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  )
}

interface BudgetGridProps {
  budget: Budget
  drag: DragSource | null
  editing: { section: BudgetSection; row: number; month: number } | null
  onStartEdit: (section: BudgetSection, row: number, month: number) => void
  onCancelEdit: () => void
  onCommitEdit: (
    section: BudgetSection,
    row: number,
    month: number,
    value: number,
  ) => void
  onDragStart: (section: BudgetSection, index: number) => void
  onDragEnd: () => void
  onDrop: (target: { section: BudgetSection; index: number }) => void
  onJumpSection: (from: BudgetSection, index: number, to: BudgetSection) => void
}

function BudgetGrid({
  budget,
  drag,
  editing,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onDragStart,
  onDragEnd,
  onDrop,
  onJumpSection,
}: BudgetGridProps): JSX.Element {
  const months = useMemo(() => monthsForBudget(budget.startMonth), [budget.startMonth])
  const colSpan = months.length + 2

  function allowDrop(e: React.DragEvent): void {
    if (drag) e.preventDefault()
  }

  return (
    <div className="budget-table-wrap">
      <table className="budget-table">
        <thead>
          <tr>
            <th className="budget-cat-col">Category</th>
            {months.map((m) => (
              <th key={m} className="budget-month-col">
                {formatMonth(m)}
              </th>
            ))}
            <th className="budget-total-col">Total</th>
          </tr>
        </thead>
        {SECTIONS.map((sec, si) => {
          const rows = budget[sec.id]
          const monthlyTotals = sectionMonthlyTotals(rows)
          const grandTotal = sectionGrandTotal(rows)
          return (
            <tbody key={sec.id}>
              <tr className="budget-section-header">
                <th colSpan={colSpan}>{sec.label}</th>
              </tr>
              {rows.length === 0 && (
                <tr
                  className="budget-empty-row"
                  onDragOver={allowDrop}
                  onDrop={() => onDrop({ section: sec.id, index: 0 })}
                >
                  <td colSpan={colSpan}>(drag categories here)</td>
                </tr>
              )}
              {rows.map((row, ri) => (
                <tr
                  key={row.category}
                  className="budget-row"
                  draggable
                  onDragStart={(e) => {
                    // Clicking a jump button shouldn't start a row drag.
                    if ((e.target as HTMLElement).closest('button')) {
                      e.preventDefault()
                      return
                    }
                    onDragStart(sec.id, ri)
                  }}
                  onDragEnd={onDragEnd}
                  onDragOver={allowDrop}
                  onDrop={() => onDrop({ section: sec.id, index: ri })}
                >
                  <th className="budget-cat-col" title="Drag to reorder or move">
                    <div className="budget-cat-cell">
                      <span className="budget-cat-name">{row.category}</span>
                      <span className="budget-cat-buttons">
                        {SECTIONS.filter((s) => s.id !== sec.id).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            className="budget-jump-btn"
                            title={`Move to ${s.label}`}
                            aria-label={`Move ${row.category} to ${s.label}`}
                            onClick={() => onJumpSection(sec.id, ri, s.id)}
                          >
                            {s.label[0]}
                          </button>
                        ))}
                      </span>
                    </div>
                  </th>
                  {months.map((_m, mi) => (
                    <BudgetCell
                      key={mi}
                      value={row.amounts[mi] ?? 0}
                      editing={
                        editing?.section === sec.id &&
                        editing.row === ri &&
                        editing.month === mi
                      }
                      onStart={() => onStartEdit(sec.id, ri, mi)}
                      onCancel={onCancelEdit}
                      onCommit={(v) => onCommitEdit(sec.id, ri, mi, v)}
                    />
                  ))}
                  <td className="budget-total-col">{formatAmount(rowTotal(row))}</td>
                </tr>
              ))}
              <tr
                className="budget-section-totals"
                onDragOver={allowDrop}
                onDrop={() => onDrop({ section: sec.id, index: rows.length })}
              >
                <th className="budget-cat-col">Total</th>
                {monthlyTotals.map((v, i) => (
                  <td key={i} className="budget-cell">
                    {formatAmount(v)}
                  </td>
                ))}
                <td className="budget-total-col">{formatAmount(grandTotal)}</td>
              </tr>
              {si < SECTIONS.length - 1 && (
                <tr className="budget-spacer" aria-hidden="true">
                  <td colSpan={colSpan} />
                </tr>
              )}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}

interface BudgetCellProps {
  value: number
  editing: boolean
  onStart: () => void
  onCancel: () => void
  onCommit: (value: number) => void
}

function BudgetCell({ value, editing, onStart, onCancel, onCommit }: BudgetCellProps): JSX.Element {
  const [input, setInput] = useState(() => String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  // When this cell becomes the editing target, seed the input and focus it.
  useEffect(() => {
    if (!editing) return
    setInput(String(value))
    inputRef.current?.focus()
    inputRef.current?.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) {
    return (
      <td className="budget-cell" onClick={onStart}>
        {formatAmount(value)}
      </td>
    )
  }

  function commit(): void {
    const trimmed = input.trim()
    if (trimmed === '') {
      onCancel()
      return
    }
    const n = Number(trimmed)
    if (Number.isNaN(n)) {
      onCancel()
      return
    }
    onCommit(n)
  }

  return (
    <td className="budget-cell budget-cell-editing">
      <input
        ref={inputRef}
        type="number"
        step="0.01"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCancel()
          }
        }}
      />
    </td>
  )
}

interface NewBudgetModalProps {
  existingNames: string[]
  onCancel: () => void
  onCreate: (name: string, startMonth: string) => void
}

function NewBudgetModal({
  existingNames,
  onCancel,
  onCreate,
}: NewBudgetModalProps): JSX.Element {
  const [name, setName] = useState('')
  const [startMonth, setStartMonth] = useState(() => currentMonth())

  const trimmed = name.trim()
  const exists = existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
  const valid = trimmed !== '' && startMonth !== '' && !exists

  function submit(): void {
    if (valid) onCreate(trimmed, startMonth)
  }

  return (
    <div className="budget-modal-backdrop" onClick={onCancel}>
      <div
        className="budget-modal"
        role="dialog"
        aria-modal="true"
        aria-label="New Budget"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="budget-modal-title">New Budget</h3>
        <div className="budget-modal-field">
          <label htmlFor="budget-new-name">Name</label>
          <input
            id="budget-new-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {exists && (
            <div className="budget-modal-error">A budget with this name already exists.</div>
          )}
        </div>
        <div className="budget-modal-field">
          <label htmlFor="budget-new-start">Start month</label>
          <input
            id="budget-new-start"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
          />
        </div>
        <div className="budget-modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!valid}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}
