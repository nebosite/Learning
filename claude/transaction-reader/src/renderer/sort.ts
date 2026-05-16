import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { effectiveValue } from '../shared/records'

export type SortDirection = 'asc' | 'desc'

/** How a column's values should be compared. */
export type ColumnKind = 'text' | 'number' | 'date' | 'boolean'

/** A field that can be sorted: any original field, or the ignored flag. */
export type SortField = keyof OriginalTransaction | 'ignored'

/** One column's sort selection. */
export interface SortState {
  field: SortField
  direction: SortDirection
}

/** A sort selection paired with the column's data type. */
export interface SortCriterion extends SortState {
  kind: ColumnKind
}

function textKey(value: unknown): string {
  return value == null ? '' : String(value).toLowerCase()
}

/** Compare two records on the given field, ascending. Returns <0, 0, or >0. */
function compareField(
  a: TransactionRecord,
  b: TransactionRecord,
  field: SortField,
  kind: ColumnKind,
): number {
  if (field === 'ignored') {
    return a.ignored === b.ignored ? 0 : a.ignored ? 1 : -1
  }
  if (kind === 'number') {
    return Number(effectiveValue(a, field)) - Number(effectiveValue(b, field))
  }
  // Both date (ISO strings sort chronologically) and text compare as strings;
  // text is case-insensitive.
  const av = kind === 'date' ? String(effectiveValue(a, field)) : textKey(effectiveValue(a, field))
  const bv = kind === 'date' ? String(effectiveValue(b, field)) : textKey(effectiveValue(b, field))
  return av < bv ? -1 : av > bv ? 1 : 0
}

/**
 * Return record indices reordered by the given sort criteria. Criteria are
 * applied in priority order: the first decides the overall order, later ones
 * break ties within equal runs of the earlier ones.
 *
 * By default the result is a permutation of `0..records.length-1`. Pass
 * `subset` to sort only those indices (e.g. a filtered set) — the result is
 * then a reordering of `subset`. Either way callers index into the original
 * `records` array, so edit/delete callbacks keep their real indices. The sort
 * is stable: records equal on every criterion keep their original order.
 */
export function computeSortOrder(
  records: readonly TransactionRecord[],
  criteria: readonly SortCriterion[],
  subset?: readonly number[],
): number[] {
  const order = subset ? subset.slice() : records.map((_, i) => i)
  if (criteria.length === 0) return order
  order.sort((ia, ib) => {
    for (const c of criteria) {
      const cmp = compareField(records[ia], records[ib], c.field, c.kind)
      if (cmp !== 0) return c.direction === 'asc' ? cmp : -cmp
    }
    return ia - ib
  })
  return order
}
