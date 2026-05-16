import { describe, expect, it } from 'vitest'
import type { OriginalTransaction, TransactionRecord } from '../shared/types'
import { recordMatchesFilter } from './filter'

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
    expect(recordMatchesFilter(r, 'amazon', FIELDS)).toBe(true)
    expect(recordMatchesFilter(r, 'mktp', FIELDS)).toBe(false)
  })

  it('only searches the fields it is given', () => {
    const r = rec({ owner: 'Alice' })
    expect(recordMatchesFilter(r, 'alice', FIELDS)).toBe(false)
    expect(recordMatchesFilter(r, 'alice', ['owner'])).toBe(true)
  })
})
