import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  Budget,
  BudgetRow,
  BudgetSection,
  OriginalTransaction,
  TransactionRecord,
} from '../shared/types'
import { effectiveDate, effectiveValue } from '../shared/records'
import { Grid, formatAmount } from './grid'
import { defaultSpendingWindow } from './report'
import './budget.css'

/**
 * Budget values display as whole dollars (no decimals). The stored value
 * keeps full precision — this is display-only — so the editor still accepts
 * what the user typed.
 */
export function formatBudgetAmount(n: number): string {
  const rounded = Math.round(n)
  const sign = rounded < 0 ? '-' : ''
  return `${sign}$${Math.abs(rounded)}`
}

/**
 * A budget cell's relationship to the matching transactions, used to color
 * the cell background:
 *   - 'empty'     — no matching transactions in this category+month
 *   - 'on-target' — |sum| within $1 of |budgeted|
 *   - 'under'     — |sum| < |budgeted| by more than $1
 *   - 'over'      — |sum| > |budgeted| by more than $1
 * Magnitudes are compared so the rule works for both spending (negative
 * transactions, positive budget) and income (both positive).
 */
export type CellStatus = 'empty' | 'on-target' | 'under' | 'over'

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

/**
 * Apply a category rename across the budget. Within each section, a row whose
 * category matches `oldName` (case-insensitive) is renamed to `newName`. If
 * the same section already contains a row with `newName`, the target row
 * absorbs the original row's 12 monthly amounts and the original row is
 * removed. The target row keeps its position.
 */
export function renameCategoryInBudget(
  budget: Budget,
  oldName: string,
  newName: string,
): Budget {
  const oldLower = oldName.trim().toLowerCase()
  const newLower = newName.trim().toLowerCase()
  if (oldLower === '') return budget

  function renameSection(rows: BudgetRow[]): BudgetRow[] {
    const oldIdx = rows.findIndex(
      (r) => r.category.trim().toLowerCase() === oldLower,
    )
    if (oldIdx === -1) return rows
    // A distinct row already holds the target name → merge into it.
    const targetIdx = rows.findIndex(
      (r, i) =>
        i !== oldIdx && r.category.trim().toLowerCase() === newLower,
    )
    if (targetIdx === -1) {
      // Plain rename in place.
      return rows.map((r, i) => (i === oldIdx ? { ...r, category: newName } : r))
    }
    const oldRow = rows[oldIdx]
    const targetRow = rows[targetIdx]
    const mergedAmounts = targetRow.amounts.map(
      (a, i) => a + (oldRow.amounts[i] ?? 0),
    )
    return rows
      .map((r, i) =>
        i === targetIdx ? { ...r, amounts: mergedAmounts } : r,
      )
      .filter((_, i) => i !== oldIdx)
  }

  return {
    ...budget,
    income: renameSection(budget.income),
    bills: renameSection(budget.bills),
    discretionary: renameSection(budget.discretionary),
  }
}

/**
 * Drop a row from the given section. Only affects this budget — the
 * underlying category (in the records list / custom categories) is untouched.
 */
export function deleteRow(
  budget: Budget,
  section: BudgetSection,
  index: number,
): Budget {
  return {
    ...budget,
    [section]: budget[section].filter((_, i) => i !== index),
  }
}

/**
 * Original-array indices of the non-ignored transactions whose effective
 * category matches the given budget cell's row category (case-insensitive,
 * trimmed) and whose effective YYYY-MM matches the budget cell's month.
 * Returns [] when the row is out of bounds, the category is blank, or no
 * records match — the selected-cell sub-grid simply renders empty.
 */
export function recordsForBudgetCell(
  records: readonly TransactionRecord[],
  budget: Budget,
  section: BudgetSection,
  rowIndex: number,
  monthIndex: number,
): number[] {
  const row = budget[section][rowIndex]
  if (!row) return []
  const cat = row.category.trim().toLowerCase()
  if (cat === '') return []
  const month = addMonths(budget.startMonth, monthIndex)
  const out: number[] = []
  records.forEach((r, i) => {
    if (r.ignored) return
    const v = effectiveValue(r, 'category')
    const rc = typeof v === 'string' ? v.trim().toLowerCase() : ''
    if (rc !== cat) return
    if (effectiveDate(r).slice(0, 7) !== month) return
    out.push(i)
  })
  return out
}

/**
 * Status used to color a budget cell's background. See {@link CellStatus}
 * for what each value means. Magnitudes are compared so the rule applies
 * symmetrically to income (positive transactions) and spending (negative).
 */
/**
 * The status derivation from a precomputed (sum, count) entry — the same
 * comparison budgetCellStatus performs, factored out so the grid renderer
 * (which already aggregates records once per render) can call it per cell.
 *
 * `monthHasAnyRecords` distinguishes "no imports for the month at all"
 * (transparent) from "imports exist, this category just had nothing"
 * (on-target — nothing happened here, which is fine).
 */
export function statusFromSum(
  entry: { sum: number; count: number } | undefined,
  budgeted: number,
  monthHasAnyRecords: boolean,
): CellStatus {
  if (!monthHasAnyRecords) return 'empty'
  if (!entry || entry.count === 0) return 'on-target'
  const diff = Math.abs(entry.sum) - Math.abs(budgeted)
  if (Math.abs(diff) <= 1) return 'on-target'
  return diff > 0 ? 'over' : 'under'
}

export function budgetCellStatus(
  records: readonly TransactionRecord[],
  budget: Budget,
  section: BudgetSection,
  rowIndex: number,
  monthIndex: number,
): CellStatus {
  const row = budget[section][rowIndex]
  if (!row) return 'empty'
  const cat = row.category.trim().toLowerCase()
  if (cat === '') return 'empty'
  const month = addMonths(budget.startMonth, monthIndex)

  // One pass: track whether *any* non-ignored record exists for this month
  // (in any category) AND sum the matching (category, month) records.
  let monthHasAnyRecords = false
  let sum = 0
  let count = 0
  for (const r of records) {
    if (r.ignored) continue
    if (effectiveDate(r).slice(0, 7) !== month) continue
    monthHasAnyRecords = true
    const cv = effectiveValue(r, 'category')
    const rc = typeof cv === 'string' ? cv.trim().toLowerCase() : ''
    if (rc !== cat) continue
    const av = effectiveValue(r, 'amount')
    if (typeof av === 'number') sum += av
    count++
  }
  return statusFromSum(
    count === 0 ? undefined : { sum, count },
    row.amounts[monthIndex] ?? 0,
    monthHasAnyRecords,
  )
}

/**
 * Replace zero budget cells with values derived from the Spending Analysis
 * pivot table (the past 12 complete calendar months of non-ignored records).
 *
 * Rules:
 *  - Categories that appear in analysis but aren't in the budget are appended
 *    to Discretionary (new rows start all-zero, then this fill applies).
 *  - Matching is by month-of-year only — the year is ignored, so future
 *    months can be filled from past data.
 *  - Only cells whose current value is exactly 0 are written. Existing
 *    non-zero values are left alone.
 *  - The written value is the analysis sum rounded outward (magnitude-up)
 *    to the nearest whole dollar (-47.30 → -48, 47.30 → 48).
 *
 * `now` is the reference date for the spending window — defaulted to the
 * current time, overridable so tests can pin the window.
 */
export function autofillBudget(
  records: readonly TransactionRecord[],
  budget: Budget,
  now: Date = new Date(),
): Budget {
  const window = defaultSpendingWindow(now)

  // (category-lower → MM (two-digit) → signed sum) from the analysis window.
  const byCatMM = new Map<string, Map<string, number>>()
  // Preserve the first-seen casing of each category so a freshly-added row
  // shows up the way the user typed it on the transaction side.
  const displayCase = new Map<string, string>()
  for (const r of records) {
    if (r.ignored) continue
    const date = effectiveDate(r)
    if (date < window.from || date > window.to) continue
    const cv = effectiveValue(r, 'category')
    const cat = typeof cv === 'string' ? cv.trim() : ''
    if (cat === '') continue
    const catKey = cat.toLowerCase()
    if (!displayCase.has(catKey)) displayCase.set(catKey, cat)
    const mm = date.slice(5, 7)
    const av = effectiveValue(r, 'amount')
    const amt = typeof av === 'number' ? av : 0
    let mmMap = byCatMM.get(catKey)
    if (!mmMap) {
      mmMap = new Map()
      byCatMM.set(catKey, mmMap)
    }
    mmMap.set(mm, (mmMap.get(mm) ?? 0) + amt)
  }

  // Magnitude-preserving ceiling: -47.3 → -48, 47.3 → 48, -47 → -47, 0 → 0.
  function ceilMagnitude(v: number): number {
    if (v === 0) return 0
    return v < 0 ? -Math.ceil(-v) : Math.ceil(v)
  }

  function findRow(
    b: Budget,
    catLower: string,
  ): { section: BudgetSection; index: number } | null {
    for (const sec of ['income', 'bills', 'discretionary'] as const) {
      const idx = b[sec].findIndex(
        (r) => r.category.trim().toLowerCase() === catLower,
      )
      if (idx !== -1) return { section: sec, index: idx }
    }
    return null
  }

  const next: Budget = {
    ...budget,
    income: budget.income.map((r) => ({ ...r, amounts: r.amounts.slice() })),
    bills: budget.bills.map((r) => ({ ...r, amounts: r.amounts.slice() })),
    discretionary: budget.discretionary.map((r) => ({
      ...r,
      amounts: r.amounts.slice(),
    })),
  }

  const budgetMonths = monthsForBudget(budget.startMonth)

  for (const [catKey, mmMap] of byCatMM) {
    const found = findRow(next, catKey)
    let section: BudgetSection
    let rowIdx: number
    if (found) {
      section = found.section
      rowIdx = found.index
    } else {
      section = 'discretionary'
      next.discretionary.push({
        category: displayCase.get(catKey) ?? catKey,
        amounts: new Array<number>(12).fill(0),
      })
      rowIdx = next.discretionary.length - 1
    }
    const row = next[section][rowIdx]
    for (let mi = 0; mi < 12; mi++) {
      const bmm = budgetMonths[mi].slice(5, 7)
      const v = mmMap.get(bmm)
      if (v === undefined) continue
      if (row.amounts[mi] !== 0) continue
      row.amounts[mi] = ceilMagnitude(v)
    }
  }

  // Discretionary always lands sorted alphabetically (case-insensitive) so
  // newly-added rows from this run aren't just appended to the bottom.
  next.discretionary.sort((a, b) =>
    a.category.toLowerCase().localeCompare(b.category.toLowerCase()),
  )

  return next
}

/**
 * Set the per-row yearly Budgeted cap. Normalizes to a non-negative whole
 * dollar — the input field rejects letters and negatives, but this also
 * defends against API/test misuse.
 */
export function updateBudgeted(
  budget: Budget,
  section: BudgetSection,
  rowIdx: number,
  value: number,
): Budget {
  const next: Budget = { ...budget, [section]: [...budget[section]] }
  const rows = next[section]
  const row = rows[rowIdx]
  if (!row) return budget
  const clean = Math.max(0, Math.round(Math.abs(value)))
  rows[rowIdx] = { ...row, budgeted: clean }
  return next
}

/**
 * Remaining = Budgeted + sum of the row's month cells. Spending records are
 * stored negative, so the sum is typically negative and remaining shrinks
 * as the year fills in. Drops below zero once spending exceeds the cap.
 */
export function rowRemaining(row: BudgetRow): number {
  return (row.budgeted ?? 0) + rowTotal(row)
}

/**
 * "Bottom Line" projection shown above the budget grid: the sum of every
 * monthly budget cell across all three sections, then minus the positive
 * Remaining values from Discretionary rows (treat the still-unspent
 * portion of the cap as if the user will spend it before year-end).
 * Negative Remainings (already overspent) are ignored here — the
 * month-cell total has already captured that spending.
 */
export function budgetBottomLine(budget: Budget): number {
  let sum = 0
  for (const sec of ['income', 'bills', 'discretionary'] as const) {
    for (const row of budget[sec]) {
      for (const a of row.amounts) sum += a
    }
  }
  for (const row of budget.discretionary) {
    const r = rowRemaining(row)
    if (r > 0) sum -= r
  }
  return sum
}

/**
 * Set or clear a per-cell comment. Empty (or whitespace-only) clears.
 * When the row's comments array ends up all-empty the field is dropped
 * entirely so legacy budgets and unannotated rows stay clean on disk.
 */
export function updateCellComment(
  budget: Budget,
  section: BudgetSection,
  rowIdx: number,
  monthIdx: number,
  comment: string,
): Budget {
  const row = budget[section][rowIdx]
  if (!row) return budget
  const value = comment
  const current = row.comments?.[monthIdx] ?? ''
  if (current === value) return budget
  const comments = (row.comments ? row.comments.slice() : new Array<string>(12).fill(''))
  while (comments.length < 12) comments.push('')
  comments[monthIdx] = value
  const allEmpty = comments.every((c) => c === '')
  const nextRow: BudgetRow = allEmpty
    ? (() => {
        const { comments: _omit, ...rest } = row
        return rest
      })()
    : { ...row, comments }
  return {
    ...budget,
    [section]: budget[section].map((r, i) => (i === rowIdx ? nextRow : r)),
  }
}

/**
 * Horizontal drag-copy state for the budget grid. The drag is constrained
 * to a single row; only the target month index changes as the cursor moves.
 */
export interface BudgetFillDrag {
  section: BudgetSection
  row: number
  sourceMonth: number
  currentMonth: number
}

/**
 * Copy the source month's value into every month between source and target
 * (inclusive of the range, exclusive of the source itself, since it already
 * holds the value). No-op when the source and target are the same month.
 */
export function fillRowRange(
  budget: Budget,
  section: BudgetSection,
  rowIdx: number,
  sourceMonth: number,
  targetMonth: number,
): Budget {
  if (sourceMonth === targetMonth) return budget
  const row = budget[section][rowIdx]
  if (!row) return budget
  const lo = Math.min(sourceMonth, targetMonth)
  const hi = Math.max(sourceMonth, targetMonth)
  const value = row.amounts[sourceMonth] ?? 0
  const amounts = row.amounts.slice()
  for (let m = lo; m <= hi; m++) {
    if (m === sourceMonth) continue
    amounts[m] = value
  }
  return {
    ...budget,
    [section]: budget[section].map((r, i) =>
      i === rowIdx ? { ...r, amounts } : r,
    ),
  }
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
  /**
   * Called when the user types a brand-new category into a section adder.
   * App's handleAddCategory dedupes case-insensitively, so passing an
   * already-known name is a no-op.
   */
  onAddCategory: (name: string) => void
  /**
   * The transactions backing the selected-cell sub-grid. Same shape passed to
   * the Spending Analysis tab's embedded Grid.
   */
  records: TransactionRecord[]
  categories: string[]
  /** Whether the Budget tab is the visible one (forwarded to the sub-Grid). */
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

export function BudgetView({
  budgets,
  availableCategories,
  onChange,
  onAddCategory,
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
}: BudgetProps): JSX.Element {
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [drag, setDrag] = useState<DragSource | null>(null)
  const [addingSection, setAddingSection] = useState<BudgetSection | null>(null)
  const [editing, setEditing] = useState<{
    section: BudgetSection
    row: number
    month: number
  } | null>(null)
  // Per-row Budgeted editor (Discretionary only). Mutually exclusive with the
  // month-cell editor — opening one closes the other.
  const [editingBudgeted, setEditingBudgeted] = useState<{
    section: BudgetSection
    row: number
  } | null>(null)
  // Horizontal drag-copy state. Constrained to a single row — only the
  // target month index moves as the cursor sweeps left/right.
  const [fillDrag, setFillDrag] = useState<BudgetFillDrag | null>(null)
  const fillDragRef = useRef<BudgetFillDrag | null>(null)
  fillDragRef.current = fillDrag
  // The cell whose comment popup is open, with the screen rect we anchor the
  // popup against. Cleared on Escape, click-outside, or when the user opens
  // another cell's editor.
  const [commentPopup, setCommentPopup] = useState<{
    section: BudgetSection
    row: number
    month: number
    anchor: { top: number; left: number; bottom: number; right: number }
  } | null>(null)
  // The popup opens in display (read-only) mode on hover; clicking it
  // promotes to edit mode. Display mode auto-dismisses when the cursor
  // leaves both the cell and the popup (with a small grace period).
  const [editingComment, setEditingComment] = useState(false)
  const closeCommentTimerRef = useRef<number | null>(null)
  // The current editing-mode flag, exposed via ref so the close-timer
  // schedulers (which are not re-bound per render) read the latest value.
  const editingCommentRef = useRef(editingComment)
  editingCommentRef.current = editingComment
  // Currently-selected month cell — drives the sub-grid below. Editing a cell
  // also selects it, but Escape closes the editor while selection persists.
  const [selectedCell, setSelectedCell] = useState<{
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
  // Stable handle for the drag-copy mouseup handler, which is bound once per
  // drag and shouldn't re-subscribe every render.
  const applyToSelectedRef = useRef(applyToSelected)
  applyToSelectedRef.current = applyToSelected

  function startFillDrag(
    section: BudgetSection,
    row: number,
    month: number,
  ): void {
    // Drag-copy and the in-cell editor are mutually exclusive.
    setEditing(null)
    setEditingBudgeted(null)
    setFillDrag({ section, row, sourceMonth: month, currentMonth: month })
  }

  function openCommentPopup(
    section: BudgetSection,
    row: number,
    month: number,
    cellRect: DOMRect,
  ): void {
    setCommentPopup({
      section,
      row,
      month,
      anchor: {
        top: cellRect.top,
        left: cellRect.left,
        bottom: cellRect.bottom,
        right: cellRect.right,
      },
    })
    setEditingComment(false)
  }

  function setCellComment(
    section: BudgetSection,
    row: number,
    month: number,
    comment: string,
  ): void {
    applyToSelected((b) =>
      updateCellComment(b, section, row, month, comment),
    )
  }

  function cancelCloseComment(): void {
    if (closeCommentTimerRef.current !== null) {
      window.clearTimeout(closeCommentTimerRef.current)
      closeCommentTimerRef.current = null
    }
  }

  function scheduleCloseComment(): void {
    if (editingCommentRef.current) return
    cancelCloseComment()
    closeCommentTimerRef.current = window.setTimeout(() => {
      closeCommentTimerRef.current = null
      setCommentPopup(null)
      setEditingComment(false)
    }, 120)
  }

  function startEditComment(): void {
    cancelCloseComment()
    setEditingComment(true)
  }

  // Close the popup on Escape or a click outside its own DOM. Click-outside
  // uses mousedown so the dismissal happens before the new target's click
  // handler runs (so e.g. clicking a different cell still opens its editor).
  useEffect(() => {
    if (!commentPopup) return
    function onMouseDown(e: MouseEvent): void {
      const t = e.target
      if (t instanceof Element && t.closest('.budget-comment-popup')) return
      setCommentPopup(null)
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setCommentPopup(null)
    }
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [commentPopup])

  // While a drag is active, track the cursor with elementFromPoint to find the
  // hovered cell (constrained to the source's row) and resolve to a copy on
  // mouseup.
  useEffect(() => {
    if (!fillDrag) return
    function onMouseMove(e: MouseEvent): void {
      const d = fillDragRef.current
      if (!d) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const td = (
        el instanceof Element ? el : null
      )?.closest('[data-budget-month]') as HTMLElement | null
      if (!td) return
      const section = td.dataset.budgetSection as BudgetSection | undefined
      const rowAttr = td.dataset.budgetRow
      const monthAttr = td.dataset.budgetMonth
      if (!section || rowAttr === undefined || monthAttr === undefined) return
      const row = Number(rowAttr)
      const month = Number(monthAttr)
      if (Number.isNaN(row) || Number.isNaN(month)) return
      if (section !== d.section || row !== d.row) return
      if (month === d.currentMonth) return
      setFillDrag({ ...d, currentMonth: month })
    }
    function onMouseUp(): void {
      const d = fillDragRef.current
      setFillDrag(null)
      if (!d || d.sourceMonth === d.currentMonth) return
      applyToSelectedRef.current((b) =>
        fillRowRange(b, d.section, d.row, d.sourceMonth, d.currentMonth),
      )
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
    // Re-bind only when a drag starts or ends — not while the cursor moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillDrag !== null])

  // Pre-aggregate non-ignored records by (category-lower | YYYY-MM) so the
  // per-cell status lookup during render is O(1). Also tracks which months
  // have *any* records (in any category) so the empty/on-target distinction
  // can be made without rescanning records per cell. Re-runs only when the
  // records array reference changes.
  const { monthlyCategorySums, monthsWithRecords } = useMemo(() => {
    const sums = new Map<string, { sum: number; count: number }>()
    const months = new Set<string>()
    for (const r of records) {
      if (r.ignored) continue
      const month = effectiveDate(r).slice(0, 7)
      months.add(month)
      const cv = effectiveValue(r, 'category')
      const cat = typeof cv === 'string' ? cv.trim().toLowerCase() : ''
      if (cat === '') continue
      const av = effectiveValue(r, 'amount')
      const amt = typeof av === 'number' ? av : 0
      const k = `${cat}|${month}`
      const entry = sums.get(k)
      if (entry) {
        entry.sum += amt
        entry.count++
      } else {
        sums.set(k, { sum: amt, count: 1 })
      }
    }
    return { monthlyCategorySums: sums, monthsWithRecords: months }
  }, [records])

  const matchingIndices = useMemo(() => {
    if (!selected || !selectedCell) return []
    return recordsForBudgetCell(
      records,
      selected,
      selectedCell.section,
      selectedCell.row,
      selectedCell.month,
    )
  }, [records, selected, selectedCell])

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

  /**
   * Add a category row to the selected budget's section. If the category is
   * already present in any section of this budget (case-insensitive), do
   * nothing — duplicate rows aren't useful and would split the row's
   * 12-month totals. The customs list is always updated so the user can
   * still pick the new name later from another budget.
   */
  function handleAddToSection(section: BudgetSection, rawName: string): void {
    const name = rawName.trim()
    if (name === '') return
    onAddCategory(name)
    if (!selected) return
    const lower = name.toLowerCase()
    const already =
      selected.income.some((r) => r.category.trim().toLowerCase() === lower) ||
      selected.bills.some((r) => r.category.trim().toLowerCase() === lower) ||
      selected.discretionary.some(
        (r) => r.category.trim().toLowerCase() === lower,
      )
    if (already) return
    applyToSelected((b) => ({
      ...b,
      [section]: [...b[section], { category: name, amounts: new Array<number>(12).fill(0) }],
    }))
  }

  /**
   * Run autofillBudget on the currently-selected budget and propagate any
   * brand-new (case-insensitively-novel) categories to the customs list so
   * the user can pick them later from other budgets / autocomplete.
   */
  function handleAutofill(): void {
    if (!selected) return
    const prevCatsLower = new Set<string>([
      ...selected.income.map((r) => r.category.trim().toLowerCase()),
      ...selected.bills.map((r) => r.category.trim().toLowerCase()),
      ...selected.discretionary.map((r) => r.category.trim().toLowerCase()),
    ])
    const next = autofillBudget(records, selected)
    for (const row of next.discretionary) {
      const key = row.category.trim().toLowerCase()
      if (!prevCatsLower.has(key)) onAddCategory(row.category)
    }
    onChange(budgets.map((b) => (b.name === selected.name ? next : b)))
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
        <button
          type="button"
          onClick={handleAutofill}
          disabled={!selected}
          title="Fill zero budget cells from the Spending Analysis pivot table"
        >
          Autofill
        </button>
        {selected && (
          <span className="budget-range">
            {formatMonth(selected.startMonth)} —{' '}
            {formatMonth(addMonths(selected.startMonth, 11))}
          </span>
        )}
      </div>

      <div className="budget-bottom-line">
        <span className="budget-bottom-line-label">Bottom line</span>
        <span
          className={`budget-bottom-line-value${
            selected && budgetBottomLine(selected) < 0 ? ' amount-negative' : ''
          }`}
        >
          {selected ? formatBudgetAmount(budgetBottomLine(selected)) : ''}
        </span>
      </div>

      {selected ? (
        <BudgetGrid
          budget={selected}
          drag={drag}
          editing={editing}
          editingBudgeted={editingBudgeted}
          selectedCell={selectedCell}
          fillDrag={fillDrag}
          onStartFill={startFillDrag}
          onRequestComment={openCommentPopup}
          commentPopupCell={
            commentPopup
              ? {
                  section: commentPopup.section,
                  row: commentPopup.row,
                  month: commentPopup.month,
                }
              : null
          }
          onCancelCloseComment={cancelCloseComment}
          onScheduleCloseComment={scheduleCloseComment}
          monthlyCategorySums={monthlyCategorySums}
          monthsWithRecords={monthsWithRecords}
          addingSection={addingSection}
          availableCategories={availableCategories}
          onStartAdd={(section) => setAddingSection(section)}
          onCancelAdd={() => setAddingSection(null)}
          onCommitAdd={(section, name) => {
            handleAddToSection(section, name)
            setAddingSection(null)
          }}
          onSelectCell={(section, row, month) =>
            setSelectedCell({ section, row, month })
          }
          onStartEdit={(section, row, month) => {
            setSelectedCell({ section, row, month })
            setEditing({ section, row, month })
            setEditingBudgeted(null)
          }}
          onCancelEdit={() => setEditing(null)}
          onCommitEdit={(section, row, month, value) => {
            applyToSelected((b) => updateCell(b, section, row, month, value))
            setEditing(null)
          }}
          onStartEditBudgeted={(section, row) => {
            setEditingBudgeted({ section, row })
            setEditing(null)
          }}
          onCancelEditBudgeted={() => setEditingBudgeted(null)}
          onCommitEditBudgeted={(section, row, value) => {
            applyToSelected((b) => updateBudgeted(b, section, row, value))
            setEditingBudgeted(null)
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
          onDeleteRow={(section, index) => {
            applyToSelected((b) => deleteRow(b, section, index))
            // The deleted row's index now points at a different row (or out of
            // range). Clear selection so we don't show stale transactions.
            if (
              selectedCell &&
              selectedCell.section === section &&
              selectedCell.row >= index
            ) {
              setSelectedCell(null)
            }
          }}
        />
      ) : (
        <p className="budget-empty">No budget selected. Click New to create one.</p>
      )}

      <div className="budget-edit">
        {selected && selectedCell ? (
          <Grid
            key={`${selected.name}-${selectedCell.section}-${selectedCell.row}-${selectedCell.month}`}
            records={subRecords}
            categories={categories}
            active={active}
            resortKey={resortKey}
            showFilter={false}
            sessionAddedKeys={sessionAddedKeys}
            onSetField={(li, field, value) =>
              onSetField(matchingIndices[li], field, value)
            }
            onRemoveOverride={(li, field) =>
              onRemoveOverride(matchingIndices[li], field)
            }
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
          <p className="budget-hint">
            Click a budget cell to show the transactions behind it.
          </p>
        )}
      </div>

      <div className="budget-total">
        <span className="budget-total-label">Transactions total</span>
        <span
          className={`budget-total-value${subTotal < 0 ? ' amount-negative' : ''}`}
        >
          {selected && selectedCell ? formatAmount(subTotal) : ''}
        </span>
      </div>

      {newOpen && (
        <NewBudgetModal
          existingNames={budgets.map((b) => b.name)}
          onCancel={() => setNewOpen(false)}
          onCreate={handleCreate}
        />
      )}

      {selected && commentPopup && (() => {
        const row = selected[commentPopup.section][commentPopup.row]
        const budgetValue = row?.amounts[commentPopup.month] ?? 0
        const cat = row?.category.trim().toLowerCase() ?? ''
        const monthString = addMonths(selected.startMonth, commentPopup.month)
        const transactionSum =
          cat === ''
            ? null
            : (monthlyCategorySums.get(`${cat}|${monthString}`)?.sum ?? null)
        return (
          <CommentPopup
            anchor={commentPopup.anchor}
            comment={row?.comments?.[commentPopup.month] ?? ''}
            mode={editingComment ? 'edit' : 'display'}
            budgetValue={budgetValue}
            transactionSum={transactionSum}
            onChange={(c) =>
              setCellComment(
                commentPopup.section,
                commentPopup.row,
                commentPopup.month,
                c,
              )
            }
            onStartEdit={startEditComment}
            onMouseEnter={cancelCloseComment}
            onMouseLeave={scheduleCloseComment}
          />
        )
      })()}
    </div>
  )
}

interface BudgetGridProps {
  budget: Budget
  drag: DragSource | null
  editing: { section: BudgetSection; row: number; month: number } | null
  /** Per-row Budgeted editor target. Only ever set for the discretionary section. */
  editingBudgeted: { section: BudgetSection; row: number } | null
  selectedCell: { section: BudgetSection; row: number; month: number } | null
  /** Active horizontal drag-copy, or null when nothing is being dragged. */
  fillDrag: BudgetFillDrag | null
  /** Called when the user mousedowns on a cell's fill handle. */
  onStartFill: (section: BudgetSection, row: number, month: number) => void
  /** Called when a cell's hover timer fires; opens the comment popup. */
  onRequestComment: (
    section: BudgetSection,
    row: number,
    month: number,
    cellRect: DOMRect,
  ) => void
  /** The cell currently showing the popup, or null. Cells use this to decide
   *  whether mouseenter/leave should arm the hover timer or instead toggle
   *  the popup's auto-dismiss countdown. */
  commentPopupCell: {
    section: BudgetSection
    row: number
    month: number
  } | null
  /** Cancel the popup's pending auto-dismiss (cursor re-entered cell/popup). */
  onCancelCloseComment: () => void
  /** Begin the popup's auto-dismiss countdown (cursor left cell/popup). */
  onScheduleCloseComment: () => void
  /** Per (category-lower | YYYY-MM) sum + count of non-ignored records. */
  monthlyCategorySums: Map<string, { sum: number; count: number }>
  /** YYYY-MM months that have at least one non-ignored record (any category). */
  monthsWithRecords: Set<string>
  addingSection: BudgetSection | null
  availableCategories: string[]
  onStartAdd: (section: BudgetSection) => void
  onCancelAdd: () => void
  onCommitAdd: (section: BudgetSection, name: string) => void
  onSelectCell: (section: BudgetSection, row: number, month: number) => void
  onStartEdit: (section: BudgetSection, row: number, month: number) => void
  onCancelEdit: () => void
  onCommitEdit: (
    section: BudgetSection,
    row: number,
    month: number,
    value: number,
  ) => void
  onStartEditBudgeted: (section: BudgetSection, row: number) => void
  onCancelEditBudgeted: () => void
  onCommitEditBudgeted: (
    section: BudgetSection,
    row: number,
    value: number,
  ) => void
  onDragStart: (section: BudgetSection, index: number) => void
  onDragEnd: () => void
  onDrop: (target: { section: BudgetSection; index: number }) => void
  onJumpSection: (from: BudgetSection, index: number, to: BudgetSection) => void
  onDeleteRow: (section: BudgetSection, index: number) => void
}

function BudgetGrid({
  budget,
  drag,
  editing,
  editingBudgeted,
  selectedCell,
  fillDrag,
  onStartFill,
  onRequestComment,
  commentPopupCell,
  onCancelCloseComment,
  onScheduleCloseComment,
  monthlyCategorySums,
  monthsWithRecords,
  addingSection,
  availableCategories,
  onStartAdd,
  onCancelAdd,
  onCommitAdd,
  onSelectCell,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  onStartEditBudgeted,
  onCancelEditBudgeted,
  onCommitEditBudgeted,
  onDragStart,
  onDragEnd,
  onDrop,
  onJumpSection,
  onDeleteRow,
}: BudgetGridProps): JSX.Element {
  const months = useMemo(() => monthsForBudget(budget.startMonth), [budget.startMonth])
  // Category + 12 months + Total + Remaining + Budgeted = 16 columns total.
  // colSpan is used by section header / spacer / drop-target rows that span
  // every column.
  const colSpan = months.length + 4

  function allowDrop(e: React.DragEvent): void {
    if (drag) e.preventDefault()
  }

  return (
    <div
      className={`budget-table-wrap${fillDrag ? ' budget-dragging' : ''}`}
    >
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
            <th className="budget-extra-col">Remaining</th>
            <th className="budget-extra-col">Budgeted</th>
          </tr>
        </thead>
        {SECTIONS.map((sec, si) => {
          const rows = budget[sec.id]
          const monthlyTotals = sectionMonthlyTotals(rows)
          const grandTotal = sectionGrandTotal(rows)
          return (
            <tbody key={sec.id}>
              <tr className="budget-section-header">
                <th colSpan={colSpan}>
                  <div className="budget-section-header-row">
                    <span>{sec.label}</span>
                    {addingSection === sec.id ? (
                      <SectionAdder
                        categories={availableCategories}
                        onCommit={(name) => onCommitAdd(sec.id, name)}
                        onCancel={onCancelAdd}
                      />
                    ) : (
                      <button
                        type="button"
                        className="budget-section-add"
                        onClick={() => onStartAdd(sec.id)}
                        aria-label={`Add category to ${sec.label}`}
                      >
                        + Add
                      </button>
                    )}
                  </div>
                </th>
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
                        <button
                          type="button"
                          className="budget-delete-btn"
                          title={`Remove ${row.category} from this budget`}
                          aria-label={`Remove ${row.category} from this budget`}
                          onClick={() => onDeleteRow(sec.id, ri)}
                        >
                          ×
                        </button>
                      </span>
                    </div>
                  </th>
                  {months.map((m, mi) => {
                    const catKey = row.category.trim().toLowerCase()
                    const entry =
                      catKey === ''
                        ? undefined
                        : monthlyCategorySums.get(`${catKey}|${m}`)
                    const status =
                      catKey === ''
                        ? 'empty'
                        : statusFromSum(
                            entry,
                            row.amounts[mi] ?? 0,
                            monthsWithRecords.has(m),
                          )
                    const inFillRange =
                      fillDrag !== null &&
                      fillDrag.section === sec.id &&
                      fillDrag.row === ri &&
                      mi >= Math.min(fillDrag.sourceMonth, fillDrag.currentMonth) &&
                      mi <= Math.max(fillDrag.sourceMonth, fillDrag.currentMonth)
                    const popupOpenForThisCell =
                      commentPopupCell !== null &&
                      commentPopupCell.section === sec.id &&
                      commentPopupCell.row === ri &&
                      commentPopupCell.month === mi
                    return (
                      <BudgetCell
                        key={mi}
                        section={sec.id}
                        rowIndex={ri}
                        monthIndex={mi}
                        value={row.amounts[mi] ?? 0}
                        status={status}
                        comment={row.comments?.[mi] ?? ''}
                        editing={
                          editing?.section === sec.id &&
                          editing.row === ri &&
                          editing.month === mi
                        }
                        selected={
                          selectedCell?.section === sec.id &&
                          selectedCell.row === ri &&
                          selectedCell.month === mi
                        }
                        inFillRange={inFillRange}
                        commentPopupOpen={popupOpenForThisCell}
                        onSelect={() => onSelectCell(sec.id, ri, mi)}
                        onStart={() => onStartEdit(sec.id, ri, mi)}
                        onCancel={onCancelEdit}
                        onCommit={(v) => onCommitEdit(sec.id, ri, mi, v)}
                        onFillStart={() => onStartFill(sec.id, ri, mi)}
                        onRequestComment={(rect) =>
                          onRequestComment(sec.id, ri, mi, rect)
                        }
                        onCancelCloseComment={onCancelCloseComment}
                        onScheduleCloseComment={onScheduleCloseComment}
                      />
                    )
                  })}
                  <td
                    className={`budget-total-col${
                      rowTotal(row) < 0 ? ' budget-cell-negative' : ''
                    }`}
                  >
                    {formatBudgetAmount(rowTotal(row))}
                  </td>
                  {sec.id === 'discretionary' ? (
                    <>
                      <td
                        className={`budget-extra-col budget-remaining-cell${
                          rowRemaining(row) < -1
                            ? ' budget-remaining-overspent'
                            : rowRemaining(row) > (row.budgeted ?? 0)
                              ? ' budget-remaining-surplus'
                              : rowRemaining(row) < 0
                                ? ' budget-cell-negative'
                                : ''
                        }${
                          rowRemaining(row) !== 0 ? ' budget-remaining-bold' : ''
                        }`}
                      >
                        {formatBudgetAmount(rowRemaining(row))}
                      </td>
                      <BudgetedCell
                        value={row.budgeted ?? 0}
                        editing={
                          editingBudgeted?.section === sec.id &&
                          editingBudgeted.row === ri
                        }
                        onStart={() => onStartEditBudgeted(sec.id, ri)}
                        onCancel={onCancelEditBudgeted}
                        onCommit={(v) => onCommitEditBudgeted(sec.id, ri, v)}
                      />
                    </>
                  ) : (
                    <>
                      <td className="budget-extra-col" />
                      <td className="budget-extra-col" />
                    </>
                  )}
                </tr>
              ))}
              <tr
                className="budget-section-totals"
                onDragOver={allowDrop}
                onDrop={() => onDrop({ section: sec.id, index: rows.length })}
              >
                <th className="budget-cat-col">Total</th>
                {monthlyTotals.map((v, i) => (
                  <td
                    key={i}
                    className={`budget-cell${v < 0 ? ' budget-cell-negative' : ''}`}
                  >
                    {formatBudgetAmount(v)}
                  </td>
                ))}
                <td
                  className={`budget-total-col${
                    grandTotal < 0 ? ' budget-cell-negative' : ''
                  }`}
                >
                  {formatBudgetAmount(grandTotal)}
                </td>
                {sec.id === 'discretionary'
                  ? (() => {
                      const budgetedTotal = rows.reduce(
                        (s, r) => s + (r.budgeted ?? 0),
                        0,
                      )
                      const remainingTotal = budgetedTotal + grandTotal
                      return (
                        <>
                          <td
                            className={`budget-extra-col budget-remaining-cell${
                              remainingTotal < -1
                                ? ' budget-remaining-overspent'
                                : remainingTotal > budgetedTotal
                                  ? ' budget-remaining-surplus'
                                  : remainingTotal < 0
                                    ? ' budget-cell-negative'
                                    : ''
                            }${
                              remainingTotal !== 0 ? ' budget-remaining-bold' : ''
                            }`}
                          >
                            {formatBudgetAmount(remainingTotal)}
                          </td>
                          <td className="budget-extra-col">
                            {formatBudgetAmount(budgetedTotal)}
                          </td>
                        </>
                      )
                    })()
                  : (
                      <>
                        <td className="budget-extra-col" />
                        <td className="budget-extra-col" />
                      </>
                    )}
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
  /** Section the cell lives in — emitted as a data attribute for hit-testing. */
  section: BudgetSection
  rowIndex: number
  monthIndex: number
  value: number
  status: CellStatus
  /** Current comment text. `''` means no comment. */
  comment: string
  editing: boolean
  selected: boolean
  /** True when an active drag-copy's span covers this cell. */
  inFillRange: boolean
  /** True when the comment popup is currently anchored at THIS cell. While
   *  that's the case, mouse enter/leave on the cell drive the popup's
   *  auto-dismiss timer instead of arming a new hover-to-open timer. */
  commentPopupOpen: boolean
  onSelect: () => void
  onStart: () => void
  onCancel: () => void
  onCommit: (value: number) => void
  /** Begin a horizontal drag-copy from this cell. */
  onFillStart: () => void
  /** Called by the 1500ms hover timer; opens the comment popup at the cell. */
  onRequestComment: (cellRect: DOMRect) => void
  /** Cancel the popup's pending auto-dismiss (cursor re-entered cell/popup). */
  onCancelCloseComment: () => void
  /** Schedule the popup's auto-dismiss countdown (cursor left cell/popup). */
  onScheduleCloseComment: () => void
}

const COMMENT_HOVER_MS = 1000

function BudgetCell({
  section,
  rowIndex,
  monthIndex,
  value,
  status,
  comment,
  editing,
  selected,
  inFillRange,
  commentPopupOpen,
  onSelect,
  onStart,
  onCancel,
  onCommit,
  onFillStart,
  onRequestComment,
  onCancelCloseComment,
  onScheduleCloseComment,
}: BudgetCellProps): JSX.Element {
  const hoverTimerRef = useRef<number | null>(null)

  function startHoverTimer(e: React.MouseEvent<HTMLTableCellElement>): void {
    if (hoverTimerRef.current !== null) return
    const td = e.currentTarget
    hoverTimerRef.current = window.setTimeout(() => {
      hoverTimerRef.current = null
      onRequestComment(td.getBoundingClientRect())
    }, COMMENT_HOVER_MS)
  }
  function clearHoverTimer(): void {
    if (hoverTimerRef.current === null) return
    window.clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
  }
  // Cancel any pending timer on unmount so we don't open a popup against a
  // cell that's just been removed.
  useEffect(() => clearHoverTimer, [])

  // While the popup is showing for this cell, mouseenter/leave drive the
  // popup's auto-dismiss timer. Otherwise they arm/cancel the hover-to-open
  // timer.
  function onCellMouseEnter(e: React.MouseEvent<HTMLTableCellElement>): void {
    if (commentPopupOpen) onCancelCloseComment()
    else startHoverTimer(e)
  }
  function onCellMouseLeave(): void {
    if (commentPopupOpen) onScheduleCloseComment()
    else clearHoverTimer()
  }
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
    const statusClass = status === 'empty' ? '' : ` budget-cell-${status}`
    const negativeClass = value < 0 ? ' budget-cell-negative' : ''
    const fillClass = inFillRange ? ' budget-cell-fill-target' : ''
    const selectedClass = selected ? ' budget-cell-selected' : ''
    const commentClass = comment !== '' ? ' budget-cell-has-comment' : ''
    return (
      <td
        className={`budget-cell${statusClass}${negativeClass}${fillClass}${selectedClass}${commentClass}`}
        data-budget-section={section}
        data-budget-row={rowIndex}
        data-budget-month={monthIndex}
        onClick={() => {
          onSelect()
          onStart()
        }}
        onMouseEnter={onCellMouseEnter}
        onMouseLeave={onCellMouseLeave}
      >
        {formatBudgetAmount(value)}
        <span
          className="budget-fill-handle"
          aria-hidden="true"
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            onFillStart()
          }}
          onClick={(e) => e.stopPropagation()}
        />
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

interface BudgetedCellProps {
  value: number
  editing: boolean
  onStart: () => void
  onCancel: () => void
  onCommit: (value: number) => void
}

/**
 * Editable yearly-cap cell on Discretionary rows. Accepts positive whole
 * dollars only — negatives and decimals are normalized on commit.
 */
function BudgetedCell({
  value,
  editing,
  onStart,
  onCancel,
  onCommit,
}: BudgetedCellProps): JSX.Element {
  const [input, setInput] = useState(() => String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!editing) return
    setInput(String(value))
    inputRef.current?.focus()
    inputRef.current?.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  if (!editing) {
    return (
      <td className="budget-extra-col budget-budgeted-cell" onClick={onStart}>
        {formatBudgetAmount(value)}
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
    onCommit(Math.max(0, Math.round(Math.abs(n))))
  }

  return (
    <td className="budget-extra-col budget-cell-editing">
      <input
        ref={inputRef}
        type="number"
        step="1"
        min="0"
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

interface SectionAdderProps {
  categories: string[]
  onCommit: (name: string) => void
  onCancel: () => void
}

interface CommentPopupProps {
  /** Cell rectangle used to anchor the popup below it. */
  anchor: { top: number; left: number; bottom: number; right: number }
  comment: string
  mode: 'display' | 'edit'
  /** Cell's budget value, used to derive the over/under-budget line. */
  budgetValue: number
  /**
   * Sum of matching transactions for this (category, month), or null when
   * no records contribute (the line is suppressed in that case).
   */
  transactionSum: number | null
  onChange: (comment: string) => void
  onStartEdit: () => void
  onMouseEnter: () => void
  onMouseLeave: () => void
}

/**
 * Build the "Spending is $X over/under budget" line for the cell, or null
 * when the spending matches within $1 (mirrors the cell-coloring threshold)
 * or when there are no transactions to compare against.
 */
function overUnderBudgetLine(
  budgetValue: number,
  transactionSum: number | null,
): string | null {
  if (transactionSum === null) return null
  const diff = Math.abs(transactionSum) - Math.abs(budgetValue)
  if (Math.abs(diff) <= 1) return null
  const amount = Math.round(Math.abs(diff))
  return diff > 0
    ? `Spending is $${amount} over budget.`
    : `Spending is $${amount} under budget.`
}

/**
 * Floating viewer/editor for a budget cell's comment. Rendered at the
 * panel level so it can escape the budget table's `overflow: hidden`
 * clipping. In display mode it shows the comment text (or a hint to add
 * one) and the over/under-budget line if applicable, dismissing itself
 * when the cursor leaves both popup and originating cell. Clicking promotes
 * to edit mode — textarea + Clear button + dismissal only on Escape or
 * click-outside (those live in BudgetView).
 */
function CommentPopup({
  anchor,
  comment,
  mode,
  budgetValue,
  transactionSum,
  onChange,
  onStartEdit,
  onMouseEnter,
  onMouseLeave,
}: CommentPopupProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (mode === 'edit') ref.current?.focus()
  }, [mode])
  const overUnder = overUnderBudgetLine(budgetValue, transactionSum)
  return (
    <div
      className="budget-comment-popup"
      style={{
        position: 'fixed',
        top: anchor.bottom + 4,
        left: anchor.left,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={mode === 'display' ? onStartEdit : undefined}
    >
      {mode === 'edit' ? (
        <textarea
          ref={ref}
          className="budget-comment-textarea"
          value={comment}
          placeholder="Enter a comment here"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <div className="budget-comment-display">
          {comment === '' ? (
            <span className="budget-comment-placeholder">
              Click to add a comment
            </span>
          ) : (
            comment
          )}
        </div>
      )}
      {overUnder && (
        <div className="budget-comment-overunder">{overUnder}</div>
      )}
      {mode === 'edit' && comment !== '' && (
        <button
          type="button"
          className="budget-comment-clear"
          onClick={() => onChange('')}
        >
          Clear this comment
        </button>
      )}
    </div>
  )
}

/**
 * Inline autocomplete used on each section header. Mirrors the grid's
 * CategoryEditor: substring-match dropdown, exact case-insensitive match wins
 * the commit, otherwise the top prediction, otherwise the trimmed input
 * (which the parent treats as a brand-new category). doneRef guards against
 * the trailing blur firing after Enter/Escape/click already resolved.
 */
function SectionAdder({ categories, onCommit, onCancel }: SectionAdderProps): JSX.Element {
  const [input, setInput] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const matches = useMemo(() => {
    const sorted = [...categories].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    )
    const q = input.trim().toLowerCase()
    return q === '' ? sorted : sorted.filter((c) => c.toLowerCase().includes(q))
  }, [categories, input])

  function resolvedValue(): string {
    const trimmed = input.trim()
    const exact = categories.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    if (exact) return exact
    return matches.length > 0 ? matches[0] : trimmed
  }

  const predicted = resolvedValue()

  function commit(): void {
    if (doneRef.current) return
    doneRef.current = true
    const v = resolvedValue()
    if (v === '') onCancel()
    else onCommit(v)
  }

  function cancel(): void {
    if (doneRef.current) return
    doneRef.current = true
    onCancel()
  }

  return (
    <span className="budget-section-adder">
      <input
        ref={inputRef}
        type="text"
        className="budget-section-adder-input"
        value={input}
        placeholder="Category…"
        onChange={(e) => setInput(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancel()
          }
        }}
      />
      {matches.length > 0 && (
        <div className="budget-section-suggest">
          {matches.map((c) => (
            <div
              key={c}
              className={`budget-section-suggest-item${c === predicted ? ' budget-section-suggest-item-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (doneRef.current) return
                doneRef.current = true
                onCommit(c)
              }}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </span>
  )
}
