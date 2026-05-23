import { useMemo, useState } from 'react'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveDate, effectiveValue } from '../shared/records'
import { Grid, formatAmount } from './grid'
import './report.css'

/** Bucket for records whose effective category is blank. */
const UNCATEGORIZED = '(uncategorized)'

const MONTH_NAMES = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function categoryOf(record: TransactionRecord): string {
  const value = effectiveValue(record, 'category')
  const text = value == null ? '' : String(value).trim()
  return text === '' ? UNCATEGORIZED : text
}

/** The YYYY-MM month bucket of a record's effective date. */
function monthOf(record: TransactionRecord): string {
  return effectiveDate(record).slice(0, 7)
}

function formatMonth(ym: string): string {
  const [year, month] = ym.split('-')
  return `${MONTH_NAMES[Number(month)] ?? month} ${year}`
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * The Spending Analysis window: exactly twelve complete calendar months,
 * ending with the previous month (the in-progress current month is excluded).
 * E.g. on any day in May 2026 the window is 2025-05-01 through 2026-04-30.
 */
export function defaultSpendingWindow(now: Date = new Date()): {
  from: string
  to: string
} {
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(firstOfMonth)
  end.setDate(end.getDate() - 1)
  const start = new Date(
    firstOfMonth.getFullYear() - 1,
    firstOfMonth.getMonth(),
    1,
  )
  return { from: toIsoDate(start), to: toIsoDate(end) }
}

/** Which column the category rows are sorted by. */
type SortField = 'category' | 'total'

interface PivotSort {
  field: SortField
  direction: 'asc' | 'desc'
}

/** A header sort button that cycles ascending -> descending -> unsorted. */
function SortButton({
  field,
  sort,
  onCycle,
}: {
  field: SortField
  sort: PivotSort | null
  onCycle: (field: SortField) => void
}): JSX.Element {
  const active = sort?.field === field
  const icon = !active ? '⇅' : sort.direction === 'asc' ? '▲' : '▼'
  const state = !active ? 'unsorted' : sort.direction === 'asc' ? 'ascending' : 'descending'
  return (
    <button
      type="button"
      className={`report-sort-btn${active ? ' report-sort-btn-active' : ''}`}
      onClick={() => onCycle(field)}
      title={`Sort by ${field} (currently ${state})`}
      aria-label={`Sort by ${field}, currently ${state}`}
    >
      {icon}
    </button>
  )
}

interface SelectedCell {
  category: string
  month: string
}

interface ReportProps {
  records: TransactionRecord[]
  categories: string[]
  active: boolean
  resortKey: number
  onSetField: (
    index: number,
    field: keyof OriginalTransaction,
    value: OriginalTransaction[keyof OriginalTransaction],
  ) => void
  onRemoveOverride: (index: number, field: keyof OriginalTransaction) => void
  onToggleIgnored: (index: number) => void
  onDelete: (index: number) => void
  onFill: (
    sourceIndex: number,
    targetIndices: number[],
    field: keyof OriginalTransaction | 'ignored',
  ) => void
}

export function Report({
  records,
  categories,
  active,
  resortKey,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
  onFill,
}: ReportProps): JSX.Element {
  const [selected, setSelected] = useState<SelectedCell | null>(null)
  const [sort, setSort] = useState<PivotSort | null>(null)

  // Capture the spending window once on mount so the boundaries don't drift
  // as the user works (e.g. across midnight or a month rollover).
  const spendingWindow = useMemo(() => defaultSpendingWindow(), [])

  // Cycle a column's sort: unsorted -> ascending -> descending -> unsorted.
  function cycleSort(field: SortField): void {
    setSort((prev) => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' }
      if (prev.direction === 'asc') return { field, direction: 'desc' }
      return null
    })
  }

  // Indices of the records the report counts: non-ignored, and with an
  // effective date inside the spending window (last ~12 months, ending right
  // before the start of the current month).
  const visibleIndices = useMemo(() => {
    const out: number[] = []
    records.forEach((r, i) => {
      if (r.ignored) return
      const date = effectiveDate(r)
      if (date < spendingWindow.from || date > spendingWindow.to) return
      out.push(i)
    })
    return out
  }, [records, spendingWindow])

  // The pivot table: months (columns), categories (rows), summed amounts, and
  // per-row / per-column / grand totals.
  const table = useMemo(() => {
    const months = new Set<string>()
    const cats = new Set<string>()
    const sums = new Map<string, Map<string, number>>()
    const rowTotals = new Map<string, number>()
    const colTotals = new Map<string, number>()
    let grandTotal = 0
    for (const i of visibleIndices) {
      const r = records[i]
      const month = monthOf(r)
      const cat = categoryOf(r)
      const value = effectiveValue(r, 'amount')
      const amount = typeof value === 'number' ? value : 0
      months.add(month)
      cats.add(cat)
      let row = sums.get(cat)
      if (!row) {
        row = new Map()
        sums.set(cat, row)
      }
      row.set(month, (row.get(month) ?? 0) + amount)
      rowTotals.set(cat, (rowTotals.get(cat) ?? 0) + amount)
      colTotals.set(month, (colTotals.get(month) ?? 0) + amount)
      grandTotal += amount
    }
    return {
      months: [...months].sort(),
      categories: [...cats].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase()),
      ),
      sums,
      rowTotals,
      colTotals,
      grandTotal,
    }
  }, [records, visibleIndices])

  // Master indices of the records behind the selected cell.
  const matchingIndices = useMemo(() => {
    if (!selected) return []
    return visibleIndices.filter((i) => {
      const r = records[i]
      return categoryOf(r) === selected.category && monthOf(r) === selected.month
    })
  }, [selected, visibleIndices, records])

  const subRecords = useMemo(
    () => matchingIndices.map((i) => records[i]),
    [matchingIndices, records],
  )

  const monthCount = table.months.length
  const avgPerMonth = (total: number): number =>
    monthCount > 0 ? total / monthCount : 0
  const avgPerYear = (total: number): number => avgPerMonth(total) * 12

  // Category rows in display order. Default is alphabetical; the Category and
  // Total header buttons re-sort them.
  const sortedCategories = useMemo(() => {
    const cats = [...table.categories]
    if (!sort) return cats
    const dir = sort.direction === 'asc' ? 1 : -1
    if (sort.field === 'category') {
      cats.sort((a, b) => dir * a.toLowerCase().localeCompare(b.toLowerCase()))
    } else {
      cats.sort(
        (a, b) =>
          dir * ((table.rowTotals.get(a) ?? 0) - (table.rowTotals.get(b) ?? 0)),
      )
    }
    return cats
  }, [table, sort])

  return (
    <div className="report-panel">
      <div className="report-table-wrap">
        {table.months.length === 0 ? (
          <p className="report-empty">No transactions match the current filter.</p>
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th className="report-corner report-sortable">
                  <span>Category</span>
                  <SortButton field="category" sort={sort} onCycle={cycleSort} />
                </th>
                {table.months.map((m) => (
                  <th key={m} className="report-month">
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="report-month report-sortable">
                  <span>Total</span>
                  <SortButton field="total" sort={sort} onCycle={cycleSort} />
                </th>
                <th className="report-month">Avg / month</th>
                <th className="report-month">Avg / year</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((cat, idx) => {
                const total = table.rowTotals.get(cat) ?? 0
                return (
                  <tr
                    key={cat}
                    className={idx % 2 === 0 ? 'report-row-even' : 'report-row-odd'}
                  >
                    <th className="report-rowhead">{cat}</th>
                    {table.months.map((m) => {
                      const value = table.sums.get(cat)?.get(m)
                      const isSelected =
                        selected?.category === cat && selected?.month === m
                      const classes = ['report-cell']
                      if (value === undefined) classes.push('report-cell-empty')
                      if (isSelected) classes.push('report-cell-selected')
                      return (
                        <td
                          key={m}
                          className={classes.join(' ')}
                          onClick={
                            value === undefined
                              ? undefined
                              : () => setSelected({ category: cat, month: m })
                          }
                        >
                          {value === undefined ? '' : formatAmount(value)}
                        </td>
                      )
                    })}
                    <td className="report-total-cell">{formatAmount(total)}</td>
                    <td className="report-total-cell">
                      {formatAmount(avgPerMonth(total))}
                    </td>
                    <td className="report-total-cell">
                      {formatAmount(avgPerYear(total))}
                    </td>
                  </tr>
                )
              })}
              <tr className="report-totals-row">
                <th className="report-rowhead">Total</th>
                {table.months.map((m) => (
                  <td key={m}>{formatAmount(table.colTotals.get(m) ?? 0)}</td>
                ))}
                <td>{formatAmount(table.grandTotal)}</td>
                <td>{formatAmount(avgPerMonth(table.grandTotal))}</td>
                <td>{formatAmount(avgPerYear(table.grandTotal))}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <div className="report-edit">
        {selected ? (
          <Grid
            key={`${selected.category} ${selected.month}`}
            records={subRecords}
            categories={categories}
            active={active}
            resortKey={resortKey}
            showFilter={false}
            onSetField={(li, field, value) => onSetField(matchingIndices[li], field, value)}
            onRemoveOverride={(li, field) => onRemoveOverride(matchingIndices[li], field)}
            onToggleIgnored={(li) => onToggleIgnored(matchingIndices[li])}
            onDelete={(li) => onDelete(matchingIndices[li])}
            onFill={(s, targets, field) =>
              onFill(
                matchingIndices[s],
                targets.map((t) => matchingIndices[t]),
                field,
              )
            }
          />
        ) : (
          <p className="report-hint">
            Click a cell above to edit the transactions behind it.
          </p>
        )}
      </div>
    </div>
  )
}
