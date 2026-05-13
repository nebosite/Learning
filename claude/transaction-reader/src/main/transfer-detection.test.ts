import { describe, expect, it } from 'vitest'
import { detectTransfers } from './transfer-detection'
import type {
  OriginalTransaction,
  TransactionOverrides,
  TransactionRecord,
} from '../shared/types'

function record(
  key: string,
  original: Partial<OriginalTransaction>,
  overrides: TransactionOverrides = {},
  ignored = false,
): TransactionRecord {
  return {
    key,
    original: {
      date: '2026-05-08',
      merchant: 'X',
      category: '',
      account: 'A',
      originalStatement: '',
      notes: '',
      amount: -1,
      tags: '',
      owner: '',
      ...original,
    },
    overrides,
    ignored,
  }
}

describe('detectTransfers', () => {
  it('pairs two fresh records that form a transfer', () => {
    const fresh = [
      record('a', { account: 'Checking', amount: -100, date: '2026-05-08' }),
      record('b', { account: 'Savings', amount: 100, date: '2026-05-08' }),
    ]
    const r = detectTransfers(fresh, [])
    expect(r.fresh[0].ignored).toBe(true)
    expect(r.fresh[1].ignored).toBe(true)
    expect(r.pairs).toHaveLength(1)
  })

  it('pairs a fresh record against an existing one without modifying existing', () => {
    const fresh = [record('new', { account: 'Checking', amount: -100, date: '2026-05-09' })]
    const existing = [record('old', { account: 'Venmo', amount: 100, date: '2026-05-08' })]
    const r = detectTransfers(fresh, existing)
    expect(r.fresh[0].ignored).toBe(true)
    expect(existing[0].ignored).toBe(false)
    expect(r.pairs).toHaveLength(1)
    expect(r.pairs[0].partner).toBe(existing[0])
  })

  it('does not pair when amounts differ in magnitude', () => {
    const fresh = [
      record('a', { account: 'Checking', amount: -100, date: '2026-05-08' }),
      record('b', { account: 'Savings', amount: 90, date: '2026-05-08' }),
    ]
    const r = detectTransfers(fresh, [])
    expect(r.fresh[0].ignored).toBe(false)
    expect(r.fresh[1].ignored).toBe(false)
    expect(r.pairs).toEqual([])
  })

  it('does not pair when accounts match', () => {
    const fresh = [
      record('a', { account: 'Checking', amount: -100, date: '2026-05-08' }),
      record('b', { account: 'Checking', amount: 100, date: '2026-05-08' }),
    ]
    const r = detectTransfers(fresh, [])
    expect(r.pairs).toEqual([])
  })

  it('does not pair when dates are outside the window', () => {
    const fresh = [
      record('a', { account: 'Checking', amount: -100, date: '2026-05-01' }),
      record('b', { account: 'Savings', amount: 100, date: '2026-05-08' }),
    ]
    const r = detectTransfers(fresh, [], { windowDays: 3 })
    expect(r.pairs).toEqual([])
  })

  it('pairs at the window edge (exactly windowDays apart)', () => {
    const fresh = [
      record('a', { account: 'Checking', amount: -100, date: '2026-05-05' }),
      record('b', { account: 'Savings', amount: 100, date: '2026-05-08' }),
    ]
    const r = detectTransfers(fresh, [], { windowDays: 3 })
    expect(r.pairs).toHaveLength(1)
  })

  it('uses effective (override) values for matching', () => {
    const fresh = [
      record(
        'a',
        { account: 'Checking', amount: 100, date: '2026-05-08' },
        { amount: -100 },
      ),
    ]
    const existing = [record('old', { account: 'Savings', amount: 100, date: '2026-05-08' })]
    const r = detectTransfers(fresh, existing)
    expect(r.fresh[0].ignored).toBe(true)
  })

  it('claims a partner at most once across multiple fresh candidates', () => {
    const fresh = [
      record('a', { account: 'Checking', amount: -100, date: '2026-05-08' }),
      record('b', { account: 'Other', amount: -100, date: '2026-05-08' }),
    ]
    const existing = [record('shared', { account: 'Savings', amount: 100, date: '2026-05-08' })]
    const r = detectTransfers(fresh, existing)
    expect(r.pairs).toHaveLength(1)
    const ignoredCount = r.fresh.filter((rec) => rec.ignored).length
    expect(ignoredCount).toBe(1)
  })

  it('does not mutate input records', () => {
    const freshIn = [record('a', { account: 'Checking', amount: -100, date: '2026-05-08' })]
    const existingIn = [record('b', { account: 'Savings', amount: 100, date: '2026-05-08' })]
    const freshSnap = JSON.parse(JSON.stringify(freshIn))
    const existingSnap = JSON.parse(JSON.stringify(existingIn))
    detectTransfers(freshIn, existingIn)
    expect(freshIn).toEqual(freshSnap)
    expect(existingIn).toEqual(existingSnap)
  })

  it('returns empty result when fresh is empty', () => {
    const r = detectTransfers([], [record('a', { account: 'X', amount: 1 })])
    expect(r.fresh).toEqual([])
    expect(r.pairs).toEqual([])
  })
})
