import { useState } from 'react'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'
import './grid.css'

type ColumnField = keyof OriginalTransaction | 'ignored'

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

interface GridProps {
  records: TransactionRecord[]
  onRemoveOverride: (index: number, field: keyof OriginalTransaction) => void
}

export function Grid({ records, onRemoveOverride }: GridProps): JSX.Element {
  return (
    <div className="grid-scroll">
      <div className="grid">
        {COLUMNS.map((col) => (
          <div key={col.field} className="header-cell">
            {col.label}
          </div>
        ))}
        {records.map((record, idx) => (
          <Row
            key={idx}
            record={record}
            onRemoveOverride={(field) => onRemoveOverride(idx, field)}
          />
        ))}
      </div>
    </div>
  )
}

interface RowProps {
  record: TransactionRecord
  onRemoveOverride: (field: keyof OriginalTransaction) => void
}

function Row({ record, onRemoveOverride }: RowProps): JSX.Element {
  // `display: contents` keeps these cells as direct grid children for layout
  // while letting us group them in the DOM for keyed rendering.
  return (
    <div style={{ display: 'contents' }}>
      {COLUMNS.map((col) => (
        <Cell
          key={col.field}
          record={record}
          column={col}
          onRemoveOverride={onRemoveOverride}
        />
      ))}
    </div>
  )
}

interface CellProps {
  record: TransactionRecord
  column: Column
  onRemoveOverride: (field: keyof OriginalTransaction) => void
}

function Cell({ record, column, onRemoveOverride }: CellProps): JSX.Element {
  const [hover, setHover] = useState(false)

  const isIgnoredRow = record.ignored
  const classes = ['cell']
  if (column.align === 'right') classes.push('cell-amount')
  if (isIgnoredRow) classes.push('cell-ignored')

  if (column.field === 'ignored') {
    return <div className={classes.join(' ')}>{formatField(record.ignored, 'ignored')}</div>
  }

  const field = column.field
  const overridden = record.overrides[field] !== undefined
  const value = effectiveValue(record, field)
  if (overridden) classes.push('cell-overridden')
  if (column.field === 'amount' && typeof value === 'number' && value < 0) {
    classes.push('cell-negative')
  }

  return (
    <div
      className={classes.join(' ')}
      onMouseEnter={overridden ? () => setHover(true) : undefined}
      onMouseLeave={overridden ? () => setHover(false) : undefined}
    >
      {formatField(value, column.field)}
      {overridden && hover && (
        <div className="tooltip">
          <div className="tooltip-original">
            Original: <strong>{formatField(record.original[field], column.field)}</strong>
          </div>
          <button onClick={() => onRemoveOverride(field)}>Remove override</button>
        </div>
      )}
    </div>
  )
}
