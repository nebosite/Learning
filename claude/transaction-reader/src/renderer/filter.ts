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
