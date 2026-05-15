import { useEffect, useRef, useState } from 'react'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'
import './grid.css'

type EditableField = keyof OriginalTransaction
type ColumnField = EditableField | 'ignored'

interface Column {
  field: ColumnField
  label: string
  align?: 'left' | 'right'
}

const COLUMNS: Column[] = [
  { field: 'date', label: 'Date' },
  { field: 'account', label: 'Account' },
  { field: 'merchant', label: 'Merchant' },
  { field: 'category', label: 'Category' },
  { field: 'amount', label: 'Amount', align: 'right' },
  { field: 'originalStatement', label: 'Statement' },
  { field: 'notes', label: 'Notes' },
  { field: 'tags', label: 'Tags' },
  { field: 'owner', label: 'Owner' },
  { field: 'ignored', label: 'Ignored' },
]

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
  return (
    <div className="grid-scroll">
      <div className="grid">
        {COLUMNS.map((col) => (
          <div key={col.field} className="header-cell">
            {col.label}
          </div>
        ))}
        <div className="header-cell" aria-label="Delete" />
        {records.map((record, idx) => (
          <Row
            key={idx}
            record={record}
            onSetField={(field, value) => onSetField(idx, field, value)}
            onRemoveOverride={(field) => onRemoveOverride(idx, field)}
            onToggleIgnored={() => onToggleIgnored(idx)}
            onDelete={() => onDelete(idx)}
          />
        ))}
      </div>
    </div>
  )
}

interface RowProps {
  record: TransactionRecord
  onSetField: (field: EditableField, value: OriginalTransaction[EditableField]) => void
  onRemoveOverride: (field: EditableField) => void
  onToggleIgnored: () => void
  onDelete: () => void
}

function Row({
  record,
  onSetField,
  onRemoveOverride,
  onToggleIgnored,
  onDelete,
}: RowProps): JSX.Element {
  return (
    <div style={{ display: 'contents' }}>
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

  const classes = ['cell', 'cell-editing']
  return (
    <div className={classes.join(' ')}>
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
