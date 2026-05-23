import { describe, expect, it } from 'vitest'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { amountInRange, dateInRange, recordMatchesFilter } from './filter'

function rec(
  original: Partial<OriginalTransaction>,
  overrides: Partial<OriginalTransaction> = {},
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
  return { key: JSON.stringify(original), original: { ...base, ...original }, overrides, ignored: false }
}

const FIELDS: (keyof OriginalTransaction)[] = ['merchant', 'category', 'account', 'notes']

describe('recordMatchesFilter', () => {
  it('matches every record on a blank query', () => {
    expect(recordMatchesFilter(rec({ merchant: 'Costco' }), '', FIELDS)).toBe(true)
    expect(recordMatchesFilter(rec({ merchant: 'Costco' }), '   ', FIELDS)).toBe(true)
  })

  it('matches case-insensitively', () => {
    expect(recordMatchesFilter(rec({ merchant: 'Costco' }), 'COSTCO', FIELDS)).toBe(true)
    expect(recordMatchesFilter(rec({ merchant: 'Costco' }), 'cost', FIELDS)).toBe(true)
  })

  it('matches a substring anywhere in a field', () => {
    expect(recordMatchesFilter(rec({ notes: 'gift for mom' }), 'for', FIELDS)).toBe(true)
  })

  it('returns false when no field contains the query', () => {
    expect(recordMatchesFilter(rec({ merchant: 'Costco' }), 'walmart', FIELDS)).toBe(false)
  })

  it('matches across any of the given fields', () => {
    expect(recordMatchesFilter(rec({ category: 'Groceries' }), 'groc', FIELDS)).toBe(true)
    expect(recordMatchesFilter(rec({ account: 'Chase Checking' }), 'chase', FIELDS)).toBe(true)
  })

  it('uses the overridden value when one is present', () => {
    const r = rec({ merchant: 'AMZN MKTP' }, { merchant: 'Amazon' })
    expect(recordMatchesFilter(r, 'Amazon', FIELDS)).toBe(true)
    expect(recordMatchesFilter(r, 'mktp', FIELDS)).toBe(false)
  })

  it('only searches the fields it is given', () => {
    const r = rec({ owner: 'Alice' })
    expect(recordMatchesFilter(r, 'alice', FIELDS)).toBe(false)
    expect(recordMatchesFilter(r, 'alice', ['owner'])).toBe(true)
  })
})

describe('amountInRange', () => {
  it('matches everything when both bounds are null', () => {
    expect(amountInRange(rec({ amount: -50 }), null, null)).toBe(true)
  })

  it('respects an inclusive lower bound', () => {
    expect(amountInRange(rec({ amount: 10 }), 10, null)).toBe(true)
    expect(amountInRange(rec({ amount: 9.99 }), 10, null)).toBe(false)
  })

  it('respects an inclusive upper bound', () => {
    expect(amountInRange(rec({ amount: 10 }), null, 10)).toBe(true)
    expect(amountInRange(rec({ amount: 10.01 }), null, 10)).toBe(false)
  })

  it('handles negative ranges', () => {
    expect(amountInRange(rec({ amount: -25 }), -100, 0)).toBe(true)
    expect(amountInRange(rec({ amount: 5 }), -100, 0)).toBe(false)
  })

  it('uses the overridden amount when present', () => {
    expect(amountInRange(rec({ amount: 500 }, { amount: 5 }), 0, 10)).toBe(true)
  })
})

describe('dateInRange', () => {
  it('matches everything when both bounds are null', () => {
    expect(dateInRange(rec({ date: '2021-06-15' }), null, null)).toBe(true)
  })

  it('respects an inclusive from bound', () => {
    expect(dateInRange(rec({ date: '2021-06-15' }), '2021-06-15', null)).toBe(true)
    expect(dateInRange(rec({ date: '2021-06-14' }), '2021-06-15', null)).toBe(false)
  })

  it('respects an inclusive to bound', () => {
    expect(dateInRange(rec({ date: '2021-06-15' }), null, '2021-06-15')).toBe(true)
    expect(dateInRange(rec({ date: '2021-06-16' }), null, '2021-06-15')).toBe(false)
  })

  it('uses the overridden date when present', () => {
    expect(dateInRange(rec({ date: '2025-01-01' }, { date: '2021-06-15' }), '2021-01-01', '2021-12-31')).toBe(true)
  })
})
