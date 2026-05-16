import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'
import { computeVisibleRange } from './virtual'
import { computeSortOrder } from './sort'
import type { ColumnKind, SortState } from './sort'
import { amountInRange, dateInRange, recordMatchesFilter } from './filter'
import './grid.css'

const ROW_HEIGHT = 30
const OVERSCAN = 8

type EditableField = keyof OriginalTransaction
type ColumnField = EditableField | 'ignored'

interface Column {
  field: ColumnField
  label: string
  kind: ColumnKind
  align?: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { field: 'date', label: 'Date', kind: 'date' },
  { field: 'account', label: 'Account', kind: 'text' },
  { field: 'merchant', label: 'Merchant', kind: 'text' },
  { field: 'category', label: 'Category', kind: 'text' },
  { field: 'amount', label: 'Amount', kind: 'number', align: 'right' },
  { field: 'originalStatement', label: 'Statement', kind: 'text' },
  { field: 'notes', label: 'Notes', kind: 'text' },
  { field: 'tags', label: 'Tags', kind: 'text' },
  { field: 'owner', label: 'Owner', kind: 'text' },
  { field: 'ignored', label: 'Ignored', kind: 'boolean' },
]

/** Columns the free-text filter searches: every text-valued column. */
const TEXT_FIELDS: EditableField[] = COLUMNS.filter((c) => c.kind === 'text').map(
  (c) => c.field as EditableField,
)

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${m}/${d}/${y}`
}

function formatAmount(n: number): string {
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

/** Parse a range-input string into a numeric bound; blank or invalid is unbounded. */
function parseBound(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isNaN(n) ? null : n
}

interface GridProps {
  records: TransactionRecord[]
  onSetField: (
    index: number,
    field: EditableField,
    value: OriginalTransaction[EditableField],
  ) => void
  onRemoveOverride: (index: number, field: EditableField) => void
  onToggleIgnored: (index: number) => void
  onDelete: (index: number) => void
}

export function Grid({
  records,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
}: GridProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [sort, setSort] = useState<SortState[]>([])
  const [filter, setFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [amountMin, setAmountMin] = useState('')
  const [amountMax, setAmountMax] = useState('')

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = (): void => setViewportHeight(el.clientHeight)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const minBound = parseBound(amountMin)
  const maxBound = parseBound(amountMax)
  const fromBound = dateFrom || null
  const toBound = dateTo || null
  const filtersActive =
    filter.trim() !== '' ||
    minBound !== null ||
    maxBound !== null ||
    fromBound !== null ||
    toBound !== null

  // `order` is the list of original record indices to display, after
  // filtering and sorting. `null` means "show every record in its natural
  // order" — the common, allocation-free case.
  const order = useMemo(() => {
    const trimmed = filter.trim()
    const filtered = !filtersActive
      ? null
      : records.reduce<number[]>((acc, r, i) => {
          if (
            recordMatchesFilter(r, trimmed, TEXT_FIELDS) &&
            amountInRange(r, minBound, maxBound) &&
            dateInRange(r, fromBound, toBound)
          ) {
            acc.push(i)
          }
          return acc
        }, [])
    if (sort.length === 0) return filtered
    const criteria = sort.map((s) => {
      const col = COLUMNS.find((c) => c.field === s.field)
      return { ...s, kind: col?.kind ?? 'text' }
    })
    return computeSortOrder(records, criteria, filtered ?? undefined)
  }, [records, sort, filter, filtersActive, minBound, maxBound, fromBound, toBound])

  const displayCount = order ? order.length : records.length

  // A shorter list (a new or tightened filter) can leave the prior scroll
  // position past the end; jump back to the top so the window stays valid.
  useEffect(() => {
    setScrollTop(0)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [filter, dateFrom, dateTo, amountMin, amountMax])

  function clearFilters(): void {
    setFilter('')
    setDateFrom('')
    setDateTo('')
    setAmountMin('')
    setAmountMax('')
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

  const rows: JSX.Element[] = []
  for (let v = first; v < last; v++) {
    const i = order ? order[v] : v
    rows.push(
      <Row
        key={i}
        top={v * ROW_HEIGHT}
        record={records[i]}
        onSetField={(field, value) => onSetField(i, field, value)}
        onRemoveOverride={(field) => onRemoveOverride(i, field)}
        onToggleIgnored={() => onToggleIgnored(i)}
        onDelete={() => onDelete(i)}
      />,
    )
  }

  return (
    <div className="grid-container">
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
      <div
        className="grid-scroll"
        ref={scrollRef}
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
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
  onSetField: (field: EditableField, value: OriginalTransaction[EditableField]) => void
  onRemoveOverride: (field: EditableField) => void
  onToggleIgnored: () => void
  onDelete: () => void
}

function Row({
  top,
  record,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
}: RowProps): JSX.Element {
  return (
    <div className="grid-row" style={{ top }}>
      {COLUMNS.map((col) => (
        <Cell
          key={col.field}
          record={record}
          column={col}
          onSetField={onSetField}
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
  onSetField: (field: EditableField, value: OriginalTransaction[EditableField]) => void
  onRemoveOverride: (field: EditableField) => void
  onToggleIgnored: () => void
}

function Cell({
  record,
  column,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
}: CellProps): JSX.Element {
  const [hover, setHover] = useState(false)
  const [editing, setEditing] = useState(false)

  const isIgnoredRow = record.ignored

  if (column.field === 'ignored') {
    return (
      <div className={`cell${isIgnoredRow ? ' cell-ignored' : ''}`}>
        <input
          type="checkbox"
          className="cell-ignore-check"
          checked={record.ignored}
          onChange={onToggleIgnored}
          aria-label="Ignored"
        />
      </div>
    )
  }

  const field = column.field
  const overridden = record.overrides[field] !== undefined
  const value = effectiveValue(record, field)

  if (editing) {
    return (
      <CellEditor
        field={field}
        initialValue={value}
        align={column.align}
        onSave={(v) => {
          onSetField(field, v)
          setEditing(false)
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  const classes = ['cell']
  if (column.align === 'right') classes.push('cell-amount')
  if (isIgnoredRow) classes.push('cell-ignored')
  if (overridden) classes.push('cell-overridden')
  if (field === 'amount' && typeof value === 'number' && value < 0) {
    classes.push('cell-negative')
  }

  return (
    <div
      className={classes.join(' ')}
      onClick={() => {
        setHover(false)
        setEditing(true)
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
    </div>
  )
}

interface CellEditorProps {
  field: EditableField
  initialValue: OriginalTransaction[EditableField]
  align?: 'left' | 'right'
  onSave: (value: OriginalTransaction[EditableField]) => void
  onCancel: () => void
}

function CellEditor({
  field,
  initialValue,
  align,
  onSave,
  onCancel,
}: CellEditorProps): JSX.Element {
  const [input, setInput] = useState(() => valueToInput(initialValue))
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function commit(): void {
    if (field === 'amount') {
      const n = Number(input)
      if (Number.isNaN(n)) {
        onCancel()
        return
      }
      onSave(n as OriginalTransaction[EditableField])
      return
    }
    if (field === 'date') {
      // <input type="date"> yields '' or YYYY-MM-DD
      if (input === '') {
        onCancel()
        return
      }
      onSave(input as OriginalTransaction[EditableField])
      return
    }
    onSave(input as OriginalTransaction[EditableField])
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
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
        onBlur={commit}
      />
    </div>
  )
}
