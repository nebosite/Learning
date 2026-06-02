import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'
import { computeVisibleRange } from './virtual'
import { computeSortOrder } from './sort'
import type { ColumnKind, SortCriterion, SortState } from './sort'
import { isFilterActive, recordPassesFilter } from './filter'
import type { FilterCriteria } from './filter'
import './grid.css'

const ROW_HEIGHT = 21
const OVERSCAN = 8
/** Height of the sticky header, subtracted when mapping a cursor Y to a row. */
const HEADER_HEIGHT = 21
/** Distance from a viewport edge at which a drag starts auto-scrolling. */
const AUTO_SCROLL_EDGE = 22
/** Pixels scrolled per auto-scroll tick while drag-copying near an edge. */
const AUTO_SCROLL_STEP = 12

/** An in-progress drag-copy ("fill") from a source cell down/up a column. */
interface FillDrag {
  field: ColumnField
  /** Original record index of the source cell. */
  sourceRecord: number
  /** Display position of the source cell. */
  sourceView: number
  /** Display position currently under the cursor. */
  currentView: number
}

type EditableField = keyof OriginalTransaction
type ColumnField = EditableField | 'ignored'

interface Column {
  field: ColumnField
  label: string
  kind: ColumnKind
  align?: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { field: 'ignored', label: 'Ignored', kind: 'boolean' },
  { field: 'date', label: 'Date', kind: 'date' },
  { field: 'account', label: 'Account', kind: 'text' },
  { field: 'merchant', label: 'Merchant', kind: 'text' },
  { field: 'category', label: 'Category', kind: 'text' },
  { field: 'amount', label: 'Amount', kind: 'number', align: 'right' },
  { field: 'originalStatement', label: 'Statement', kind: 'text' },
  { field: 'notes', label: 'Notes', kind: 'text' },
  { field: 'tags', label: 'Tags', kind: 'text' },
  { field: 'owner', label: 'Owner', kind: 'text' },
]

/** Columns the free-text filter searches: every text-valued column. */
export const TEXT_FIELDS: EditableField[] = COLUMNS.filter((c) => c.kind === 'text').map(
  (c) => c.field as EditableField,
)

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${m}/${d}/${y}`
}

export function formatAmount(n: number): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toFixed(2)}`
}

function formatField(value: unknown, field: ColumnField): string {
  if (field === 'amount' && typeof value === 'number') return formatAmount(value)
  if (field === 'date' && typeof value === 'string') return formatDate(value)
  if (field === 'ignored') return value ? 'Yes' : ''
  return value == null ? '' : String(value)
}

function inputType(field: EditableField): 'text' | 'number' | 'date' {
  if (field === 'amount') return 'number'
  if (field === 'date') return 'date'
  return 'text'
}

/** Convert a field value to the string an input should display when editing. */
function valueToInput(value: OriginalTransaction[EditableField]): string {
  return value == null ? '' : String(value)
}

interface GridProps {
  records: TransactionRecord[]
  categories: string[]
  /** Whether this grid's tab is currently showing. */
  active: boolean
  /** Bumped to force a resort/refilter against the current record values. */
  resortKey: number
  /** Show the filter bar (text/date/amount). Defaults to true. */
  showFilter?: boolean
  /**
   * Canonical keys of records imported during this session. Rows whose key
   * is in the set render with bold text. Not persisted to disk.
   */
  sessionAddedKeys?: Set<string>
  /** Called whenever the filter changes, so other views can mirror it. */
  onFilterChange?: (filter: FilterCriteria) => void
  onSetField: (
    index: number,
    field: EditableField,
    value: OriginalTransaction[EditableField],
  ) => void
  onRemoveOverride: (index: number, field: EditableField) => void
  onToggleIgnored: (index: number) => void
  onDelete: (index: number) => void
  /** Copy the source cell's value into every target record for `field`. */
  onFill: (sourceIndex: number, targetIndices: number[], field: ColumnField) => void
}

export function Grid({
  records,
  categories,
  active,
  resortKey,
  showFilter = true,
  sessionAddedKeys,
  onFilterChange,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
  onFill,
}: GridProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  // The active drag-copy, or null. Mirrored to a ref for window listeners.
  const [drag, setDrag] = useState<FillDrag | null>(null)
  const dragRef = useRef<FillDrag | null>(null)
  dragRef.current = drag
  // Latest cursor Y and derived values the drag listeners read without
  // re-subscribing on every render.
  const pointerYRef = useRef(0)
  const orderRef = useRef<number[] | null>(null)
  const displayCountRef = useRef(0)
  // The record at the top of the viewport, remembered so the scroll position
  // survives filter/sort changes and tab switches. `offset` is the partial
  // row scrolled past, so restoration is pixel-exact when the row still shows.
  const anchorRef = useRef<{ record: number; offset: number } | null>(null)
  const [sort, setSort] = useState<SortState[]>([])
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')
  // The cell currently being edited (original record index + field), or null.
  const [editing, setEditing] = useState<{ row: number; field: EditableField } | null>(
    null,
  )

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Ignore zero heights: the scroll container reports 0 while its tab is
    // hidden, which would otherwise corrupt the virtualization window.
    const measure = (): void => {
      if (el.clientHeight > 0) setViewportHeight(el.clientHeight)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const criteria: FilterCriteria = {
    text: filter,
    dateFrom,
    dateTo,
    amountMin,
    amountMax,
  }
  const filtersActive = isFilterActive(criteria)

  // Notify the app of filter changes so other views (the report) can mirror it.
  useEffect(() => {
    onFilterChange?.({ text: filter, dateFrom, dateTo, amountMin, amountMax })
  }, [filter, dateFrom, dateTo, amountMin, amountMax, onFilterChange])

  // The active sort criteria paired with each column's data type.
  function sortCriteria(): SortCriterion[] {
    return sort.map((s) => {
      const col = COLUMNS.find((c) => c.field === s.field)
      return { ...s, kind: col?.kind ?? 'text' }
    })
  }

  // `order` is the list of original record indices to display, after
  // filtering and sorting. `null` means "show every record in its natural
  // order" — the common, allocation-free case.
  //
  // It deliberately does NOT depend on `records`, so editing a cell never
  // re-sorts or re-filters: the row keeps its position with the new value.
  // It recomputes only on a sort/filter change, a resort request, or a
  // record-count change (delete/import), where stale indices would break.
  const order = useMemo(() => {
    const filtered = !filtersActive
      ? null
      : records.reduce<number[]>((acc, r, i) => {
          if (recordPassesFilter(r, criteria, TEXT_FIELDS)) acc.push(i)
          return acc
        }, [])
    if (sort.length === 0) return filtered
    return computeSortOrder(records, sortCriteria(), filtered ?? undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records.length, resortKey, sort, filter, dateFrom, dateTo, amountMin, amountMax])

  const displayCount = order ? order.length : records.length

  // Mirror render-derived values so the window-level drag listeners can read
  // the latest without being re-subscribed on every render.
  orderRef.current = order
  displayCountRef.current = displayCount


  // Map a cursor Y position to the display row under it (clamped to range).
  function viewPosFromY(clientY: number): number {
    const el = scrollRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const contentY = clientY - rect.top - HEADER_HEIGHT + el.scrollTop
    const v = Math.floor(contentY / ROW_HEIGHT)
    return Math.max(0, Math.min(v, displayCountRef.current - 1))
  }

  // Begin a drag-copy from the fill handle of the given cell.
  function startFill(
    field: ColumnField,
    sourceRecord: number,
    sourceView: number,
    clientY: number,
  ): void {
    pointerYRef.current = clientY
    setDrag({ field, sourceRecord, sourceView, currentView: sourceView })
  }

  // Finish a drag-copy: copy the source value into every spanned record.
  function finishFill(): void {
    const d = dragRef.current
    setDrag(null)
    if (!d) return
    const lo = Math.min(d.sourceView, d.currentView)
    const hi = Math.max(d.sourceView, d.currentView)
    const ord = orderRef.current
    const targets: number[] = []
    for (let v = lo; v <= hi; v++) {
      if (v === d.sourceView) continue
      targets.push(ord ? ord[v] : v)
    }
    if (targets.length > 0) onFill(d.sourceRecord, targets, d.field)
  }

  // While a drag is active, track the cursor and auto-scroll near the edges.
  const dragging = drag !== null
  useEffect(() => {
    if (!dragging) return
    function onMouseMove(e: MouseEvent): void {
      pointerYRef.current = e.clientY
      const v = viewPosFromY(e.clientY)
      setDrag((d) => (d && d.currentView !== v ? { ...d, currentView: v } : d))
    }
    function onMouseUp(): void {
      finishFill()
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    const timer = window.setInterval(() => {
      const el = scrollRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const y = pointerYRef.current
      let delta = 0
      if (y < rect.top + HEADER_HEIGHT + AUTO_SCROLL_EDGE) delta = -AUTO_SCROLL_STEP
      else if (y > rect.bottom - AUTO_SCROLL_EDGE) delta = AUTO_SCROLL_STEP
      if (delta === 0) return
      el.scrollTop += delta
      const v = viewPosFromY(y)
      setDrag((d) => (d && d.currentView !== v ? { ...d, currentView: v } : d))
    }, 30)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging])

  // Record the top-of-viewport row as the scroll anchor on every scroll.
  function handleScroll(top: number): void {
    setScrollTop(top)
    if (displayCount === 0) {
      anchorRef.current = null
      return
    }
    const topView = Math.min(
      displayCount - 1,
      Math.max(0, Math.floor(top / ROW_HEIGHT)),
    )
    anchorRef.current = {
      record: order ? order[topView] : topView,
      offset: top - topView * ROW_HEIGHT,
    }
  }

  // Scroll back to the anchored record. If it was filtered out, land on the
  // next still-visible record in sort order instead.
  function restoreScroll(): void {
    const el = scrollRef.current
    const anchor = anchorRef.current
    if (!el || !anchor || displayCount === 0) return

    let viewPos: number
    if (!order) {
      viewPos = anchor.record
    } else {
      const orderPos = new Map<number, number>()
      order.forEach((rec, i) => orderPos.set(rec, i))
      const direct = orderPos.get(anchor.record)
      if (direct !== undefined) {
        viewPos = direct
      } else {
        const sortedAll = computeSortOrder(records, sortCriteria())
        const rank = sortedAll.indexOf(anchor.record)
        viewPos = displayCount - 1
        for (let r = rank + 1; r < sortedAll.length; r++) {
          const p = orderPos.get(sortedAll[r])
          if (p !== undefined) {
            viewPos = p
            break
          }
        }
      }
    }
    viewPos = Math.max(0, Math.min(viewPos, displayCount - 1))
    el.scrollTop = viewPos * ROW_HEIGHT + anchor.offset
    setScrollTop(el.scrollTop)
  }

  // Restore the remembered scroll position when the tab becomes active or the
  // filter/sort/resort changes. (Edits are intentionally excluded — `records`
  // is not a dependency — so editing a cell never moves the scroll.)
  useLayoutEffect(() => {
    if (!active) return
    const el = scrollRef.current
    if (el && el.clientHeight > 0) setViewportHeight(el.clientHeight)
    restoreScroll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, filter, dateFrom, dateTo, amountMin, amountMax, sort, resortKey])

  function clearFilters(): void {
    setFilter('')
    setDateFrom('')
    setDateTo('')
    setAmountMin('')
    setAmountMax('')
  }

  // Scroll the given display row into view if it is outside the viewport.
  function ensureRowVisible(viewPos: number): void {
    const el = scrollRef.current
    if (!el) return
    const top = viewPos * ROW_HEIGHT
    if (top < el.scrollTop) {
      el.scrollTop = top
    } else if (top + ROW_HEIGHT > el.scrollTop + el.clientHeight) {
      el.scrollTop = top + ROW_HEIGHT - el.clientHeight
    }
  }

  // The original record index `delta` display rows away from `recordIndex`,
  // or null when that would fall outside the list. Scrolls it into view.
  function relativeRecord(recordIndex: number, delta: number): number | null {
    const curView = order ? order.indexOf(recordIndex) : recordIndex
    if (curView < 0) return null
    const nextView = curView + delta
    if (nextView < 0 || nextView >= displayCount) return null
    ensureRowVisible(nextView)
    return order ? order[nextView] : nextView
  }

  // Save an edited cell. On Enter (`advance`), move the editor down to the same
  // field of the next transaction; otherwise just close the editor.
  function commitEdit(
    row: number,
    field: EditableField,
    value: OriginalTransaction[EditableField],
    advance: boolean,
  ): void {
    onSetField(row, field, value)
    const next = advance ? relativeRecord(row, 1) : null
    setEditing(next === null ? null : { row: next, field })
  }

  // Abandon the current edit (no save) and move the editor to the same field
  // of the previous (`delta` -1) or next (`delta` +1) transaction.
  function moveEdit(row: number, field: EditableField, delta: -1 | 1): void {
    const target = relativeRecord(row, delta)
    setEditing(target === null ? null : { row: target, field })
  }

  // Cycle a column: not sorted -> ascending -> descending -> removed.
  // Adding a column appends it as the lowest sort priority; toggling an
  // existing column's direction leaves its priority unchanged.
  function cycleSort(field: ColumnField): void {
    setSort((prev) => {
      const idx = prev.findIndex((s) => s.field === field)
      if (idx === -1) return [...prev, { field, direction: 'asc' }]
      if (prev[idx].direction === 'asc') {
        const next = prev.slice()
        next[idx] = { field, direction: 'desc' }
        return next
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  const { first, last } = computeVisibleRange(
    scrollTop,
    viewportHeight,
    ROW_HEIGHT,
    displayCount,
    OVERSCAN,
  )

  const fillLo = drag ? Math.min(drag.sourceView, drag.currentView) : -1
  const fillHi = drag ? Math.max(drag.sourceView, drag.currentView) : -1

  const rows: JSX.Element[] = []
  for (let v = first; v < last; v++) {
    const i = order ? order[v] : v
    const inFillRange = drag !== null && v >= fillLo && v <= fillHi
    rows.push(
      <Row
        key={i}
        top={v * ROW_HEIGHT}
        record={records[i]}
        sessionAdded={sessionAddedKeys?.has(records[i].key) ?? false}
        categories={categories}
        editingField={editing && editing.row === i ? editing.field : null}
        fillField={inFillRange ? drag.field : null}
        onFillStart={(field, clientY) => startFill(field, i, v, clientY)}
        onStartEdit={(field) => setEditing({ row: i, field })}
        onSave={(field, value, advance) => commitEdit(i, field, value, advance)}
        onCancelEdit={() => setEditing(null)}
        onMove={(field, delta) => moveEdit(i, field, delta)}
        onRemoveOverride={(field) => onRemoveOverride(i, field)}
        onToggleIgnored={() => onToggleIgnored(i)}
        onDelete={() => onDelete(i)}
      />,
    )
  }

  return (
    <div className="grid-container">
      {showFilter && (
        <div className="grid-filter">
        <input
          type="text"
          className="grid-filter-input"
          placeholder="Filter transactions…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter transactions"
        />
        <span className="filter-range">
          <span className="filter-range-label">Date</span>
          <input
            type="date"
            className="filter-range-input"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label="Date from"
          />
          <span className="filter-range-dash">–</span>
          <input
            type="date"
            className="filter-range-input"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label="Date to"
          />
        </span>
        <span className="filter-range">
          <span className="filter-range-label">Amount</span>
          <input
            type="number"
            step="0.01"
            className="filter-range-input filter-range-amount"
            placeholder="min"
            value={amountMin}
            onChange={(e) => setAmountMin(e.target.value)}
            aria-label="Amount minimum"
          />
          <span className="filter-range-dash">–</span>
          <input
            type="number"
            step="0.01"
            className="filter-range-input filter-range-amount"
            placeholder="max"
            value={amountMax}
            onChange={(e) => setAmountMax(e.target.value)}
            aria-label="Amount maximum"
          />
        </span>
        {filtersActive && (
          <>
            <span className="grid-filter-count">
              {displayCount} of {records.length}
            </span>
            <button
              type="button"
              className="filter-clear-btn"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </>
        )}
        </div>
      )}
      <div
        className={`grid-scroll${dragging ? ' grid-dragging' : ''}`}
        ref={scrollRef}
        onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}
      >
        <div className="grid-header">
        {COLUMNS.map((col) => {
          const sortIndex = sort.findIndex((s) => s.field === col.field)
          const active = sortIndex !== -1
          const dir = active ? sort[sortIndex].direction : null
          const icon = !active ? '⇅' : dir === 'asc' ? '▲' : '▼'
          const state = !active ? 'none' : dir === 'asc' ? 'ascending' : 'descending'
          return (
            <div
              key={col.field}
              className={`header-cell${col.align === 'right' ? ' header-cell-amount' : ''}`}
            >
              <span className="header-label">{col.label}</span>
              <button
                type="button"
                className={`sort-btn${active ? ' sort-btn-active' : ''}`}
                onClick={() => cycleSort(col.field)}
                title={`Sort by ${col.label} (currently ${state})`}
                aria-label={`Sort by ${col.label}, currently ${state}`}
              >
                {active && sort.length > 1 && (
                  <span className="sort-priority">{sortIndex + 1}</span>
                )}
                {icon}
              </button>
            </div>
          )
        })}
        <div className="header-cell" aria-label="Delete" />
      </div>
        <div className="grid-body" style={{ height: displayCount * ROW_HEIGHT }}>
          {rows}
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  top: number
  record: TransactionRecord
  /** True for rows whose record was imported this session — renders bold. */
  sessionAdded: boolean
  categories: string[]
  editingField: EditableField | null
  /** The column highlighted by an in-progress drag-copy on this row, or null. */
  fillField: ColumnField | null
  onFillStart: (field: ColumnField, clientY: number) => void
  onStartEdit: (field: EditableField) => void
  onSave: (
    field: EditableField,
    value: OriginalTransaction[EditableField],
    advance: boolean,
  ) => void
  onCancelEdit: () => void
  onMove: (field: EditableField, delta: -1 | 1) => void
  onRemoveOverride: (field: EditableField) => void
  onToggleIgnored: () => void
  onDelete: () => void
}

function Row({
  top,
  record,
  sessionAdded,
  categories,
  editingField,
  fillField,
  onFillStart,
  onStartEdit,
  onSave,
  onCancelEdit,
  onMove,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
}: RowProps): JSX.Element {
  return (
    <div
      className={`grid-row${editingField === 'category' ? ' grid-row-editing' : ''}${sessionAdded ? ' grid-row-added' : ''}`}
      style={{ top }}
    >
      {COLUMNS.map((col) => (
        <Cell
          key={col.field}
          record={record}
          column={col}
          categories={categories}
          editing={editingField === col.field}
          fillHighlight={fillField === col.field}
          onFillStart={onFillStart}
          onStartEdit={onStartEdit}
          onSave={onSave}
          onCancelEdit={onCancelEdit}
          onMove={onMove}
          onRemoveOverride={onRemoveOverride}
          onToggleIgnored={onToggleIgnored}
        />
      ))}
      <div className={`cell cell-delete${record.ignored ? ' cell-ignored' : ''}`}>
        <button
          type="button"
          className="delete-btn"
          onClick={onDelete}
          title="Delete this record"
          aria-label="Delete this record"
        >
          ×
        </button>
      </div>
    </div>
  )
}

interface CellProps {
  record: TransactionRecord
  column: Column
  categories: string[]
  editing: boolean
  /** Whether this cell is inside an in-progress drag-copy selection. */
  fillHighlight: boolean
  onFillStart: (field: ColumnField, clientY: number) => void
  onStartEdit: (field: EditableField) => void
  onSave: (
    field: EditableField,
    value: OriginalTransaction[EditableField],
    advance: boolean,
  ) => void
  onCancelEdit: () => void
  onMove: (field: EditableField, delta: -1 | 1) => void
  onRemoveOverride: (field: EditableField) => void
  onToggleIgnored: () => void
}

/** Small blue square in a cell's lower-right corner that begins a drag-copy. */
function FillHandle({
  field,
  onFillStart,
}: {
  field: ColumnField
  onFillStart: (field: ColumnField, clientY: number) => void
}): JSX.Element {
  return (
    <div
      className="fill-handle"
      aria-hidden="true"
      onMouseDown={(e) => {
        e.stopPropagation()
        e.preventDefault()
        onFillStart(field, e.clientY)
      }}
      onClick={(e) => e.stopPropagation()}
    />
  )
}

function Cell({
  record,
  column,
  categories,
  editing,
  fillHighlight,
  onFillStart,
  onStartEdit,
  onSave,
  onCancelEdit,
  onMove,
  onRemoveOverride,
  onToggleIgnored,
}: CellProps): JSX.Element {
  const [hover, setHover] = useState(false)

  const isIgnoredRow = record.ignored
  const isCategory = column.field === 'category'

  if (column.field === 'ignored') {
    return (
      <div
        className={`cell${isIgnoredRow ? ' cell-ignored' : ''}${fillHighlight ? ' cell-fill-target' : ''}`}
      >
        <input
          type="checkbox"
          className="cell-ignore-check"
          checked={record.ignored}
          onChange={onToggleIgnored}
          aria-label="Ignored"
        />
        <FillHandle field={column.field} onFillStart={onFillStart} />
      </div>
    )
  }

  const field = column.field
  const overridden = record.overrides[field] !== undefined
  const value = effectiveValue(record, field)

  if (editing && isCategory) {
    return (
      <CategoryEditor
        initialValue={value == null ? '' : String(value)}
        categories={categories}
        onSave={(v, advance) => onSave(field, v, advance)}
        onCancel={onCancelEdit}
        onMove={(delta) => onMove(field, delta)}
      />
    )
  }

  if (editing) {
    return (
      <CellEditor
        field={field}
        initialValue={value}
        align={column.align}
        onSave={(v, advance) => onSave(field, v, advance)}
        onCancel={onCancelEdit}
        onMove={(delta) => onMove(field, delta)}
      />
    )
  }

  const classes = ['cell']
  if (column.align === 'right') classes.push('cell-amount')
  if (isIgnoredRow) classes.push('cell-ignored')
  if (overridden) classes.push('cell-overridden')
  if (fillHighlight) classes.push('cell-fill-target')
  if (field === 'amount' && typeof value === 'number' && value < 0) {
    classes.push('cell-negative')
  }

  return (
    <div
      className={classes.join(' ')}
      onClick={() => {
        setHover(false)
        onStartEdit(field)
      }}
      onMouseEnter={overridden ? () => setHover(true) : undefined}
      onMouseLeave={overridden ? () => setHover(false) : undefined}
    >
      <div className="cell-content">{formatField(value, field)}</div>
      {overridden && hover && (
        <div className="tooltip" onClick={(e) => e.stopPropagation()}>
          <div className="tooltip-original">
            Original: <strong>{formatField(record.original[field], field)}</strong>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRemoveOverride(field)
              setHover(false)
            }}
          >
            Remove override
          </button>
        </div>
      )}
      <FillHandle field={column.field} onFillStart={onFillStart} />
    </div>
  )
}

interface CellEditorProps {
  field: EditableField
  initialValue: OriginalTransaction[EditableField]
  align?: 'left' | 'right'
  /** `advance` is true when committed with Enter (move to the next row). */
  onSave: (value: OriginalTransaction[EditableField], advance: boolean) => void
  onCancel: () => void
  /** Abandon the edit and move to the previous (-1) or next (+1) row. */
  onMove: (delta: -1 | 1) => void
}

function CellEditor({
  field,
  initialValue,
  align,
  onSave,
  onCancel,
  onMove,
}: CellEditorProps): JSX.Element {
  const [input, setInput] = useState(() => valueToInput(initialValue))
  const inputRef = useRef<HTMLInputElement>(null)
  // Guards against a trailing blur firing after Enter/Escape/arrow already
  // resolved the edit (which would otherwise commit a second time).
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit(advance: boolean): void {
    if (doneRef.current) return
    doneRef.current = true
    if (field === 'amount') {
      const n = Number(input)
      if (Number.isNaN(n)) onCancel()
      else onSave(n as OriginalTransaction[EditableField], advance)
      return
    }
    // <input type="date"> yields '' or YYYY-MM-DD
    if (field === 'date' && input === '') {
      onCancel()
      return
    }
    onSave(input as OriginalTransaction[EditableField], advance)
  }

  function move(delta: -1 | 1): void {
    if (doneRef.current) return
    doneRef.current = true
    onMove(delta)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (doneRef.current) return
      doneRef.current = true
      onCancel()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      move(-1)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      move(1)
    }
  }

  return (
    <div className="cell cell-editing">
      <input
        ref={inputRef}
        type={inputType(field)}
        step={field === 'amount' ? '0.01' : undefined}
        value={input}
        className={`cell-edit-input${align === 'right' ? ' cell-amount' : ''}`}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(false)}
      />
    </div>
  )
}

interface CategoryEditorProps {
  initialValue: string
  categories: string[]
  /** `advance` is true when committed with Enter (move to the next row). */
  onSave: (value: string, advance: boolean) => void
  onCancel: () => void
  /** Abandon the edit and move to the previous (-1) or next (+1) row. */
  onMove: (delta: -1 | 1) => void
}

function CategoryEditor({
  initialValue,
  categories,
  onSave,
  onCancel,
  onMove,
}: CategoryEditorProps): JSX.Element {
  const [input, setInput] = useState(initialValue)
  const inputRef = useRef<HTMLInputElement>(null)
  // Guards against a trailing blur firing after Enter/Escape/arrow/click
  // already resolved the edit (which would commit or cancel a second time).
  const doneRef = useRef(false)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Prediction: categories containing what's typed anywhere, sorted.
  const matches = useMemo(() => {
    const sorted = [...categories].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase()),
    )
    const q = input.trim().toLowerCase()
    return q === '' ? sorted : sorted.filter((c) => c.toLowerCase().includes(q))
  }, [categories, input])

  // The value Enter commits: an exact existing category (case-insensitive)
  // wins; otherwise the top prediction; otherwise the typed text becomes a
  // brand-new category.
  function resolvedValue(): string {
    const trimmed = input.trim()
    const exact = categories.find((c) => c.toLowerCase() === trimmed.toLowerCase())
    if (exact) return exact
    return matches.length > 0 ? matches[0] : trimmed
  }

  const predicted = resolvedValue()

  function commit(advance: boolean): void {
    if (doneRef.current) return
    doneRef.current = true
    const v = resolvedValue()
    if (v === '') onCancel()
    else onSave(v, advance)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(true)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (doneRef.current) return
      doneRef.current = true
      onCancel()
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (doneRef.current) return
      doneRef.current = true
      onMove(e.key === 'ArrowUp' ? -1 : 1)
    }
  }

  return (
    <div className="cell cell-editing">
      <input
        ref={inputRef}
        type="text"
        value={input}
        className="cell-edit-input"
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => commit(false)}
      />
      {matches.length > 0 && (
        <div className="cat-suggest">
          {matches.map((c) => (
            <div
              key={c}
              className={`cat-suggest-item${c === predicted ? ' cat-suggest-item-active' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (doneRef.current) return
                doneRef.current = true
                onSave(c, false)
              }}
            >
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
