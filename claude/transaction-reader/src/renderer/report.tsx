import { useMemo, useState } from 'react'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveDate, effectiveValue } from '../shared/records'
import { Grid, formatAmount } from './grid'
import './report.css'

/** Bucket for records whose effective category is blank. */
const UNCATEGORIZED = '(uncategorized)'
/** Display label for records whose effective merchant is blank. */
const NO_MERCHANT_LABEL = '(no merchant)'

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

/** The merchant key (raw effective value) used to group / filter records. */
function merchantKey(record: TransactionRecord): string {
  const value = effectiveValue(record, 'merchant')
  return value == null ? '' : String(value)
}

function displayMerchant(key: string): string {
  return key.trim() === '' ? NO_MERCHANT_LABEL : key
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

/** Enumerate the YYYY-MM months between window.from and window.to, inclusive. */
export function monthsInWindow(window: { from: string; to: string }): string[] {
  const [fy, fm] = window.from.split('-').slice(0, 2).map(Number)
  const [ty, tm] = window.to.split('-').slice(0, 2).map(Number)
  const out: string[] = []
  let year = fy
  let month = fm
  while (year < ty || (year === ty && month <= tm)) {
    out.push(`${year}-${String(month).padStart(2, '0')}`)
    month++
    if (month > 12) {
      month = 1
      year++
    }
  }
  return out
}

interface SortState<F> {
  field: F
  direction: 'asc' | 'desc'
}

type PivotSortField = 'category' | 'total'
type MerchantSortField = 'selected' | 'merchant' | 'total'

/** A header sort button that cycles ascending -> descending -> unsorted. */
function SortButton<F extends string>({
  field,
  label,
  sort,
  onCycle,
}: {
  field: F
  label?: string
  sort: SortState<F> | null
  onCycle: (field: F) => void
}): JSX.Element {
  const active = sort?.field === field
  const icon = !active ? '⇅' : sort.direction === 'asc' ? '▲' : '▼'
  const state = !active ? 'unsorted' : sort.direction === 'asc' ? 'ascending' : 'descending'
  const name = label ?? field
  return (
    <button
      type="button"
      className={`report-sort-btn${active ? ' report-sort-btn-active' : ''}`}
      onClick={() => onCycle(field)}
      title={`Sort by ${name} (currently ${state})`}
      aria-label={`Sort by ${name}, currently ${state}`}
    >
      {icon}
    </button>
  )
}

/**
 * What the user has clicked in the pivot table. A `cell` selection shows the
 * transactions for one (category, month); a `row` selection (triggered by
 * clicking the category name) shows every transaction in that category across
 * the entire window.
 */
type Selection =
  | { kind: 'cell'; category: string; month: string }
  | { kind: 'row'; category: string }

interface MerchantTotal {
  /** Raw merchant key — '' is preserved so it round-trips through the set. */
  key: string
  total: number
}

interface ReportProps {
  records: TransactionRecord[]
  categories: string[]
  active: boolean
  resortKey: number
  /** Forwarded to the embedded sub-grid for bold styling of session imports. */
  sessionAddedKeys?: Set<string>
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
  sessionAddedKeys,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
  onFill,
}: ReportProps): JSX.Element {
  const [selected, setSelected] = useState<Selection | null>(null)
  const [pivotSort, setPivotSort] = useState<SortState<PivotSortField> | null>(null)
  // The merchants the user has explicitly chosen to focus on. An empty set
  // means "no filter" — all merchants pass through. The Clear button resets
  // this to empty.
  const [selectedMerchants, setSelectedMerchants] = useState<Set<string>>(
    () => new Set(),
  )
  const [merchantSort, setMerchantSort] = useState<SortState<MerchantSortField> | null>(
    { field: 'total', direction: 'asc' },
  )

  const spendingWindow = useMemo(() => defaultSpendingWindow(), [])

  function cyclePivotSort(field: PivotSortField): void {
    setPivotSort((prev) => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' }
      if (prev.direction === 'asc') return { field, direction: 'desc' }
      return null
    })
  }

  function cycleMerchantSort(field: MerchantSortField): void {
    setMerchantSort((prev) => {
      if (!prev || prev.field !== field) return { field, direction: 'asc' }
      if (prev.direction === 'asc') return { field, direction: 'desc' }
      return null
    })
  }

  // Records the merchant panel is built from: non-ignored AND in the window.
  // NOT filtered by the merchant selection — the panel always shows every
  // available merchant.
  const windowIndices = useMemo(() => {
    const out: number[] = []
    records.forEach((r, i) => {
      if (r.ignored) return
      const date = effectiveDate(r)
      if (date < spendingWindow.from || date > spendingWindow.to) return
      out.push(i)
    })
    return out
  }, [records, spendingWindow])

  // Records the pivot table counts: when at least one merchant is selected,
  // restrict to those; an empty selection means "show everything".
  const pivotIndices = useMemo(() => {
    if (selectedMerchants.size === 0) return windowIndices
    return windowIndices.filter((i) => selectedMerchants.has(merchantKey(records[i])))
  }, [windowIndices, selectedMerchants, records])

  // Every merchant present in the window plus the spend total for each.
  const merchants = useMemo(() => {
    const totals = new Map<string, number>()
    for (const i of windowIndices) {
      const r = records[i]
      const key = merchantKey(r)
      const value = effectiveValue(r, 'amount')
      const amount = typeof value === 'number' ? value : 0
      totals.set(key, (totals.get(key) ?? 0) + amount)
    }
    return [...totals.entries()].map<MerchantTotal>(([key, total]) => ({ key, total }))
  }, [records, windowIndices])

  const sortedMerchants = useMemo(() => {
    const arr = [...merchants]
    if (!merchantSort) return arr
    const dir = merchantSort.direction === 'asc' ? 1 : -1
    if (merchantSort.field === 'merchant') {
      arr.sort((a, b) =>
        dir * displayMerchant(a.key)
          .toLowerCase()
          .localeCompare(displayMerchant(b.key).toLowerCase()),
      )
    } else if (merchantSort.field === 'total') {
      arr.sort((a, b) => dir * (a.total - b.total))
    } else {
      // 'selected': selected merchants first when ascending.
      arr.sort((a, b) => {
        const aSel = selectedMerchants.has(a.key) ? 0 : 1
        const bSel = selectedMerchants.has(b.key) ? 0 : 1
        return dir * (aSel - bSel)
      })
    }
    return arr
  }, [merchants, merchantSort, selectedMerchants])

  function toggleMerchant(key: string): void {
    setSelectedMerchants((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearMerchantSelection(): void {
    setSelectedMerchants(new Set())
  }

  // The pivot table: months (columns), categories (rows), summed amounts, and
  // per-row / per-column / grand totals. Months are the full window, not just
  // months with data.
  const table = useMemo(() => {
    const months = monthsInWindow(spendingWindow)
    const cats = new Set<string>()
    const sums = new Map<string, Map<string, number>>()
    const rowTotals = new Map<string, number>()
    const colTotals = new Map<string, number>()
    let grandTotal = 0
    for (const i of pivotIndices) {
      const r = records[i]
      const month = monthOf(r)
      const cat = categoryOf(r)
      const value = effectiveValue(r, 'amount')
      const amount = typeof value === 'number' ? value : 0
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
      months,
      categories: [...cats].sort((a, b) =>
        a.toLowerCase().localeCompare(b.toLowerCase()),
      ),
      sums,
      rowTotals,
      colTotals,
      grandTotal,
    }
  }, [records, pivotIndices, spendingWindow])

  const matchingIndices = useMemo(() => {
    if (!selected) return []
    return pivotIndices.filter((i) => {
      const r = records[i]
      if (categoryOf(r) !== selected.category) return false
      return selected.kind === 'row' ? true : monthOf(r) === selected.month
    })
  }, [selected, pivotIndices, records])

  const subRecords = useMemo(
    () => matchingIndices.map((i) => records[i]),
    [matchingIndices, records],
  )

  // Sum of the sub-grid amounts — shown in the bottom "section 3" strip.
  const subTotal = useMemo(() => {
    let sum = 0
    for (const r of subRecords) {
      const v = effectiveValue(r, 'amount')
      if (typeof v === 'number') sum += v
    }
    return sum
  }, [subRecords])

  const monthCount = table.months.length
  const avgPerMonth = (total: number): number =>
    monthCount > 0 ? total / monthCount : 0
  const avgPerYear = (total: number): number => avgPerMonth(total) * 12

  const sortedCategories = useMemo(() => {
    const cats = [...table.categories]
    if (!pivotSort) return cats
    const dir = pivotSort.direction === 'asc' ? 1 : -1
    if (pivotSort.field === 'category') {
      cats.sort((a, b) => dir * a.toLowerCase().localeCompare(b.toLowerCase()))
    } else {
      cats.sort(
        (a, b) =>
          dir * ((table.rowTotals.get(a) ?? 0) - (table.rowTotals.get(b) ?? 0)),
      )
    }
    return cats
  }, [table, pivotSort])

  /** Pick a CSS class for a number-bearing cell: red when negative. */
  const negativeClass = (n: number | undefined): string =>
    n !== undefined && n < 0 ? ' amount-negative' : ''

  return (
    <div className="report-panel">
      <div className="report-top-row">
        <div className="report-table-wrap">
          {table.categories.length === 0 ? (
            <p className="report-empty">
              No transactions in the selected window.
            </p>
          ) : (
            <table className="report-table">
              <thead>
                <tr>
                  <th className="report-corner">
                    <div className="sort-head">
                      <span>Category</span>
                      <SortButton
                        field="category"
                        sort={pivotSort}
                        onCycle={cyclePivotSort}
                      />
                    </div>
                  </th>
                  {table.months.map((m) => (
                    <th key={m} className="report-month">
                      {formatMonth(m)}
                    </th>
                  ))}
                  <th className="report-month">
                    <div className="sort-head sort-head-right">
                      <span>Total</span>
                      <SortButton
                        field="total"
                        sort={pivotSort}
                        onCycle={cyclePivotSort}
                      />
                    </div>
                  </th>
                  <th className="report-month">Avg / month</th>
                  <th className="report-month">Avg / year</th>
                </tr>
              </thead>
              <tbody>
                {sortedCategories.map((cat, idx) => {
                  const total = table.rowTotals.get(cat) ?? 0
                  const rowSelected =
                    selected?.kind === 'row' && selected.category === cat
                  return (
                    <tr
                      key={cat}
                      className={idx % 2 === 0 ? 'report-row-even' : 'report-row-odd'}
                    >
                      <th
                        className={`report-rowhead report-rowhead-clickable${
                          rowSelected ? ' report-cell-selected' : ''
                        }`}
                        onClick={() => setSelected({ kind: 'row', category: cat })}
                        title="Select all transactions in this category"
                      >
                        {cat}
                      </th>
                      {table.months.map((m) => {
                        const value = table.sums.get(cat)?.get(m)
                        const cellSelected =
                          selected?.kind === 'cell' &&
                          selected.category === cat &&
                          selected.month === m
                        const isSelected = cellSelected || rowSelected
                        const classes = ['report-cell']
                        if (value === undefined) classes.push('report-cell-empty')
                        if (isSelected) classes.push('report-cell-selected')
                        else if (value !== undefined && value < 0)
                          classes.push('amount-negative')
                        return (
                          <td
                            key={m}
                            className={classes.join(' ')}
                            onClick={
                              value === undefined
                                ? undefined
                                : () =>
                                    setSelected({
                                      kind: 'cell',
                                      category: cat,
                                      month: m,
                                    })
                            }
                          >
                            {value === undefined ? '' : formatAmount(value)}
                          </td>
                        )
                      })}
                      <td className={`report-total-cell${negativeClass(total)}`}>
                        {formatAmount(total)}
                      </td>
                      <td
                        className={`report-total-cell${negativeClass(avgPerMonth(total))}`}
                      >
                        {formatAmount(avgPerMonth(total))}
                      </td>
                      <td
                        className={`report-total-cell${negativeClass(avgPerYear(total))}`}
                      >
                        {formatAmount(avgPerYear(total))}
                      </td>
                    </tr>
                  )
                })}
                <tr className="report-totals-row">
                  <th className="report-rowhead">Total</th>
                  {table.months.map((m) => {
                    const v = table.colTotals.get(m) ?? 0
                    return (
                      <td key={m} className={negativeClass(v).trim()}>
                        {formatAmount(v)}
                      </td>
                    )
                  })}
                  <td className={negativeClass(table.grandTotal).trim()}>
                    {formatAmount(table.grandTotal)}
                  </td>
                  <td className={negativeClass(avgPerMonth(table.grandTotal)).trim()}>
                    {formatAmount(avgPerMonth(table.grandTotal))}
                  </td>
                  <td className={negativeClass(avgPerYear(table.grandTotal)).trim()}>
                    {formatAmount(avgPerYear(table.grandTotal))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
        <div className="report-merchant-wrap">
          <table className="merchant-table">
            <thead>
              <tr>
                <th className="merchant-check-col">
                  <div className="sort-head sort-head-center">
                    <SortButton
                      field="selected"
                      label="selection"
                      sort={merchantSort}
                      onCycle={cycleMerchantSort}
                    />
                  </div>
                </th>
                <th className="merchant-name-col">
                  <div className="sort-head">
                    <span>Merchant</span>
                    <SortButton
                      field="merchant"
                      sort={merchantSort}
                      onCycle={cycleMerchantSort}
                    />
                  </div>
                </th>
                <th className="merchant-total-col">
                  <div className="sort-head sort-head-right">
                    <span>Total</span>
                    <SortButton
                      field="total"
                      sort={merchantSort}
                      onCycle={cycleMerchantSort}
                    />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="merchant-clear-row">
                <td colSpan={3} className="merchant-clear-cell">
                  <button
                    type="button"
                    className="merchant-clear-btn"
                    onClick={clearMerchantSelection}
                    disabled={selectedMerchants.size === 0}
                  >
                    Clear ({selectedMerchants.size} selected)
                  </button>
                </td>
              </tr>
              {sortedMerchants.map((m, idx) => (
                <tr
                  key={m.key}
                  className={idx % 2 === 0 ? 'merchant-row-even' : 'merchant-row-odd'}
                >
                  <td className="merchant-check-col">
                    <input
                      type="checkbox"
                      checked={selectedMerchants.has(m.key)}
                      onChange={() => toggleMerchant(m.key)}
                      aria-label={displayMerchant(m.key)}
                    />
                  </td>
                  <td className="merchant-name-cell">{displayMerchant(m.key)}</td>
                  <td
                    className={`merchant-total-cell${negativeClass(m.total)}`}
                  >
                    {formatAmount(m.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="report-edit">
        {selected ? (
          <Grid
            key={
              selected.kind === 'row'
                ? `${selected.category} row`
                : `${selected.category} ${selected.month}`
            }
            records={subRecords}
            categories={categories}
            active={active}
            resortKey={resortKey}
            showFilter={false}
            sessionAddedKeys={sessionAddedKeys}
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
      <div className="report-total">
        <span className="report-total-label">Transactions total</span>
        <span
          className={`report-total-value${subTotal < 0 ? ' amount-negative' : ''}`}
        >
          {selected ? formatAmount(subTotal) : ''}
        </span>
      </div>
    </div>
  )
}
