import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'

/**
 * Whether a record matches a free-text filter. The query is matched
 * case-insensitively as a substring against each of the given fields'
 * effective (override-aware) values. A blank query matches every record.
 */
export function recordMatchesFilter(
  record: TransactionRecord,
  query: string,
  fields: readonly (keyof OriginalTransaction)[],
): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return fields.some((field) => {
    const value = effectiveValue(record, field)
    return value != null && String(value).toLowerCase().includes(q)
  })
}

/**
 * Whether a record's effective amount falls within `[min, max]`, inclusive.
 * A `null` bound is unbounded on that side; `null`/`null` matches everything.
 */
export function amountInRange(
  record: TransactionRecord,
  min: number | null,
  max: number | null,
): boolean {
  const amount = effectiveValue(record, 'amount')
  if (min !== null && amount < min) return false
  if (max !== null && amount > max) return false
  return true
}

/**
 * Whether a record's effective date falls within `[from, to]`, inclusive.
 * Bounds are ISO date strings (YYYY-MM-DD) compared lexically; a `null` bound
 * is unbounded on that side.
 */
export function dateInRange(
  record: TransactionRecord,
  from: string | null,
  to: string | null,
): boolean {
  const date = effectiveValue(record, 'date')
  if (from !== null && date < from) return false
  if (to !== null && date > to) return false
  return true
}

/** The five filter inputs as the raw strings the filter UI holds. */
export interface FilterCriteria {
  text: string
  dateFrom: string
  dateTo: string
  amountMin: string
  amountMax: string
}

export const EMPTY_FILTER: FilterCriteria = {
  text: '',
  dateFrom: '',
  dateTo: '',
  amountMin: '',
  amountMax: '',
}

/** Parse a range-input string into a numeric bound; blank or invalid is unbounded. */
export function parseBound(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  return Number.isNaN(n) ? null : n
}

/** Whether any filter criterion is set. */
export function isFilterActive(c: FilterCriteria): boolean {
  return (
    c.text.trim() !== '' ||
    c.dateFrom !== '' ||
    c.dateTo !== '' ||
    parseBound(c.amountMin) !== null ||
    parseBound(c.amountMax) !== null
  )
}

/** Whether a record passes all of the text/date/amount filter criteria. */
export function recordPassesFilter(
  record: TransactionRecord,
  c: FilterCriteria,
  textFields: readonly (keyof OriginalTransaction)[],
): boolean {
  return (
    recordMatchesFilter(record, c.text, textFields) &&
    amountInRange(record, parseBound(c.amountMin), parseBound(c.amountMax)) &&
    dateInRange(record, c.dateFrom || null, c.dateTo || null)
  )
}
