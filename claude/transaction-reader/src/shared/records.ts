import type { IsoDate, OriginalTransaction, TransactionRecord } from './types'

/**
 * Stable dedup identity for a record, derived from the parsed original fields
 * rather than the raw line text. Two records with the same date, merchant,
 * account, original statement, notes, and amount produce the same key — so
 * the same logical transaction dedupes across input formats (Monarch TSV,
 * Monarch CSV, Amazon CSV) and across export changes that touch other fields
 * (category, tags, owner).
 */
export function canonicalRecordKey(original: OriginalTransaction): string {
  return [
    original.date,
    original.merchant,
    original.account,
    original.originalStatement,
    original.notes,
    String(original.amount),
  ].join('\t')
}

/**
 * The effective value of a field on a record: override wins over original.
 * `undefined` in the override (missing key) falls through to the original.
 */
export function effectiveValue<K extends keyof OriginalTransaction>(
  record: TransactionRecord,
  field: K,
): OriginalTransaction[K] {
  const override = record.overrides[field]
  return override !== undefined ? override : record.original[field]
}

/** Convenience: effective date for a record. */
export function effectiveDate(record: TransactionRecord): IsoDate {
  return effectiveValue(record, 'date')
}

/**
 * Apply a category rename across a set of records. Any record whose effective
 * category matches `oldName` (case-insensitive) gets `overrides.category` set
 * to `newName`. The immutable `original` field is never modified — overrides
 * carry the rename, so the user can always see what the source export had.
 *
 * Returns a new array; records that didn't need to change keep their existing
 * reference. Match is case-insensitive on the assumption that elsewhere in
 * the app (`handleAddCategory`, the usedCategoryKeys set) categories are
 * also treated case-insensitively.
 */
export function renameCategoryInRecords(
  records: readonly TransactionRecord[],
  oldName: string,
  newName: string,
): TransactionRecord[] {
  const oldLower = oldName.trim().toLowerCase()
  if (oldLower === '') return [...records]
  return records.map((r) => {
    const effective = effectiveValue(r, 'category')
    if (typeof effective !== 'string') return r
    if (effective.trim().toLowerCase() !== oldLower) return r
    return { ...r, overrides: { ...r.overrides, category: newName } }
  })
}

/**
 * Return a new array of records sorted by effective date, newest first.
 * Sort is stable, so records with the same effective date keep their input order.
 */
export function sortRecordsByDateDescending(
  records: readonly TransactionRecord[],
): TransactionRecord[] {
  return [...records].sort((a, b) => {
    const da = effectiveDate(a)
    const db = effectiveDate(b)
    if (da < db) return 1
    if (da > db) return -1
    return 0
  })
}
