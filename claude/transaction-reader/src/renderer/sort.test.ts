import { describe, expect, it } from 'vitest'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { computeSortOrder } from './sort'

function rec(
  original: Partial<OriginalTransaction>,
  overrides: Partial<OriginalTransaction> = {},
  ignored = false,
): TransactionRecord {
  const base: OriginalTransaction = {
    date: '2021-01-01',
    merchant: '',
    category: '',
    account: '',
    originalStatement: '',
    notes: '',
    amount: 0,
    tags: '',
    owner: '',
  }
  return { key: JSON.stringify(original), original: { ...base, ...original }, overrides, ignored }
}

describe('computeSortOrder', () => {
  it('returns identity order when there are no criteria', () => {
    const records = [rec({ merchant: 'b' }), rec({ merchant: 'a' })]
    expect(computeSortOrder(records, [])).toEqual([0, 1])
  })

  it('sorts text ascending and ignores case', () => {
    const records = [rec({ merchant: 'banana' }), rec({ merchant: 'Apple' }), rec({ merchant: 'cherry' })]
    expect(computeSortOrder(records, [{ field: 'merchant', direction: 'asc', kind: 'text' }])).toEqual([1, 0, 2])
  })

  it('sorts text descending', () => {
    const records = [rec({ merchant: 'banana' }), rec({ merchant: 'Apple' }), rec({ merchant: 'cherry' })]
    expect(computeSortOrder(records, [{ field: 'merchant', direction: 'desc', kind: 'text' }])).toEqual([2, 0, 1])
  })

  it('sorts numbers numerically, not lexically', () => {
    const records = [rec({ amount: 9 }), rec({ amount: 100 }), rec({ amount: 20 })]
    expect(computeSortOrder(records, [{ field: 'amount', direction: 'asc', kind: 'number' }])).toEqual([0, 2, 1])
  })

  it('sorts dates chronologically', () => {
    const records = [rec({ date: '2021-12-01' }), rec({ date: '2021-02-15' }), rec({ date: '2021-02-09' })]
    expect(computeSortOrder(records, [{ field: 'date', direction: 'asc', kind: 'date' }])).toEqual([2, 1, 0])
  })

  it('sorts the ignored flag with false before true', () => {
    const records = [rec({}, {}, true), rec({}, {}, false), rec({}, {}, true)]
    expect(computeSortOrder(records, [{ field: 'ignored', direction: 'asc', kind: 'boolean' }])).toEqual([1, 0, 2])
  })

  it('uses the effective (overridden) value', () => {
    const records = [rec({ merchant: 'zzz' }, { merchant: 'aaa' }), rec({ merchant: 'mmm' })]
    expect(computeSortOrder(records, [{ field: 'merchant', direction: 'asc', kind: 'text' }])).toEqual([0, 1])
  })

  it('is stable: ties keep original order in both directions', () => {
    const records = [rec({ merchant: 'x' }), rec({ merchant: 'x' }), rec({ merchant: 'x' })]
    expect(computeSortOrder(records, [{ field: 'merchant', direction: 'asc', kind: 'text' }])).toEqual([0, 1, 2])
    expect(computeSortOrder(records, [{ field: 'merchant', direction: 'desc', kind: 'text' }])).toEqual([0, 1, 2])
  })

  it('breaks ties on the first criterion with later criteria', () => {
    // Sort by category first, then by amount within each category.
    const records = [
      rec({ category: 'Food', amount: 30 }),
      rec({ category: 'Auto', amount: 50 }),
      rec({ category: 'Food', amount: 10 }),
      rec({ category: 'Auto', amount: 20 }),
    ]
    const order = computeSortOrder(records, [
      { field: 'category', direction: 'asc', kind: 'text' },
      { field: 'amount', direction: 'asc', kind: 'number' },
    ])
    expect(order).toEqual([3, 1, 2, 0])
  })

  it('sorts only the given subset of indices', () => {
    const records = [rec({ amount: 30 }), rec({ amount: 10 }), rec({ amount: 20 }), rec({ amount: 5 })]
    const order = computeSortOrder(
      records,
      [{ field: 'amount', direction: 'asc', kind: 'number' }],
      [0, 2, 1],
    )
    expect(order).toEqual([1, 2, 0])
  })

  it('applies criteria in priority order', () => {
    // Same records, amount-first gives a different overall order than category-first.
    const records = [
      rec({ category: 'Food', amount: 30 }),
      rec({ category: 'Auto', amount: 50 }),
      rec({ category: 'Food', amount: 10 }),
      rec({ category: 'Auto', amount: 20 }),
    ]
    const order = computeSortOrder(records, [
      { field: 'amount', direction: 'asc', kind: 'number' },
      { field: 'category', direction: 'asc', kind: 'text' },
    ])
    expect(order).toEqual([2, 3, 0, 1])
  })
})
