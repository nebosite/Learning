import { describe, expect, it } from 'vitest'
import type { OriginalTransaction, TransactionRecord } from './types'
import { renameCategoryInRecords } from './records'

function rec(
  original: Partial<OriginalTransaction>,
  overrides: Partial<OriginalTransaction> = {},
): TransactionRecord {
  const base: OriginalTransaction = {
    date: '2026-01-01',
    merchant: '',
    category: '',
    account: '',
    originalStatement: '',
    notes: '',
    amount: 0,
    tags: '',
    owner: '',
  }
  return {
    key: JSON.stringify({ ...base, ...original }),
    original: { ...base, ...original },
    overrides,
    ignored: false,
  }
}

describe('renameCategoryInRecords', () => {
  it('adds a category override on a record whose original matches', () => {
    const r = rec({ category: 'Food' })
    const out = renameCategoryInRecords([r], 'Food', 'Eating')
    expect(out[0].overrides.category).toBe('Eating')
    // The immutable original is preserved verbatim.
    expect(out[0].original.category).toBe('Food')
  })

  it('updates the override on a record whose effective (overridden) category matches', () => {
    const r = rec({ category: 'Travel' }, { category: 'Food' })
    const out = renameCategoryInRecords([r], 'Food', 'Eating')
    expect(out[0].overrides.category).toBe('Eating')
    expect(out[0].original.category).toBe('Travel')
  })

  it('leaves records alone when their effective category does not match', () => {
    const r = rec({ category: 'Food' }, { category: 'Travel' })
    const out = renameCategoryInRecords([r], 'Food', 'Eating')
    // effective category is "Travel", not "Food" → untouched.
    expect(out[0]).toBe(r)
  })

  it('matches case-insensitively (and writes the new casing verbatim)', () => {
    const r = rec({ category: 'food' })
    const out = renameCategoryInRecords([r], 'Food', 'Eating Out')
    expect(out[0].overrides.category).toBe('Eating Out')
  })

  it('returns a new array; does not mutate the input', () => {
    const r = rec({ category: 'Food' })
    const before = JSON.parse(JSON.stringify(r))
    const out = renameCategoryInRecords([r], 'Food', 'Eating')
    expect(out).not.toBe([r])
    expect(r).toEqual(before)
  })

  it('keeps unchanged records by reference', () => {
    const matching = rec({ category: 'Food' })
    const other = rec({ category: 'Books' })
    const out = renameCategoryInRecords([matching, other], 'Food', 'Eating')
    expect(out[1]).toBe(other)
  })

  it('is a no-op when oldName is blank', () => {
    const r = rec({ category: '' })
    const out = renameCategoryInRecords([r], '', 'Something')
    expect(out[0]).toBe(r)
  })
})
