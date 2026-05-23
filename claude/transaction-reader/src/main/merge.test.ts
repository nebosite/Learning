import { describe, expect, it } from 'vitest'
import { mergeIntoMaster } from './merge'
import type { ParsedRow } from './csv-format'
import type {
  MasterFile,
  OriginalTransaction,
  TransactionRecord,
  TransactionOverrides,
} from '../shared/types'
import { canonicalRecordKey } from '../shared/records'

const DEFAULTS: OriginalTransaction = {
  date: '2026-05-08',
  merchant: 'X',
  category: '',
  account: 'A',
  originalStatement: '',
  notes: '',
  amount: -1,
  tags: '',
  owner: '',
}

function row(partial: Partial<OriginalTransaction> = {}): ParsedRow {
  const parsed: OriginalTransaction = { ...DEFAULTS, ...partial }
  return { raw: canonicalRecordKey(parsed), parsed }
}

function existing(
  originalPartial: Partial<OriginalTransaction> = {},
  overrides: TransactionOverrides = {},
): TransactionRecord {
  const original: OriginalTransaction = { ...DEFAULTS, ...originalPartial }
  return {
    key: canonicalRecordKey(original),
    original,
    overrides,
    ignored: false,
  }
}

const emptyMaster: MasterFile = { version: 1, records: [] }

describe('mergeIntoMaster', () => {
  it('adds all rows when the master is empty', () => {
    const r = mergeIntoMaster(emptyMaster, [
      row({ merchant: 'A' }),
      row({ merchant: 'B' }),
    ])
    expect(r.added).toHaveLength(2)
    expect(r.skipped).toEqual([])
    expect(r.master.records).toHaveLength(2)
  })

  it('preserves within-batch duplicates as separate records', () => {
    // Two rows with identical canonical fields land twice when the master
    // does not already hold a matching record.
    const r = mergeIntoMaster(emptyMaster, [row(), row()])
    expect(r.added).toHaveLength(2)
    expect(r.skipped).toEqual([])
  })

  it('is idempotent when re-importing the same batch', () => {
    const batch = [row(), row(), row({ merchant: 'B' })]
    const first = mergeIntoMaster(emptyMaster, batch)
    const second = mergeIntoMaster(first.master, batch)
    expect(second.added).toEqual([])
    expect(second.skipped).toHaveLength(3)
    expect(second.master.records).toHaveLength(3)
  })

  it('count-matches: skips up to N existing, adds the rest', () => {
    const master: MasterFile = { version: 1, records: [existing()] }
    const r = mergeIntoMaster(master, [row(), row()])
    expect(r.added).toHaveLength(1)
    expect(r.skipped).toHaveLength(1)
  })

  it('sorts records by effective date descending', () => {
    const r = mergeIntoMaster(emptyMaster, [
      row({ merchant: 'a', date: '2026-05-07' }),
      row({ merchant: 'b', date: '2026-05-09' }),
      row({ merchant: 'c', date: '2026-05-08' }),
    ])
    expect(r.master.records.map((rec) => rec.original.merchant)).toEqual([
      'b',
      'c',
      'a',
    ])
  })

  it('uses the override date for sorting when one exists', () => {
    const master: MasterFile = {
      version: 1,
      records: [
        existing({ merchant: 'a', date: '2026-05-01' }, { date: '2026-05-09' }),
        existing({ merchant: 'b', date: '2026-05-05' }),
      ],
    }
    const r = mergeIntoMaster(master, [])
    expect(r.master.records.map((rec) => rec.original.merchant)).toEqual(['a', 'b'])
  })

  it('does not mutate the input master', () => {
    const master: MasterFile = { version: 1, records: [existing()] }
    const before = JSON.parse(JSON.stringify(master))
    mergeIntoMaster(master, [row({ merchant: 'B' }), row({ merchant: 'C' })])
    expect(master).toEqual(before)
  })

  it('preserves master.version in the result', () => {
    const r = mergeIntoMaster({ version: 1, records: [] }, [])
    expect(r.master.version).toBe(1)
  })

  it('stores the canonical key on added records, not the raw line text', () => {
    const r = mergeIntoMaster(emptyMaster, [
      { raw: 'whatever-the-line-said', parsed: { ...DEFAULTS, merchant: 'M' } },
    ])
    expect(r.added[0].key).toBe(canonicalRecordKey({ ...DEFAULTS, merchant: 'M' }))
    expect(r.added[0].key).not.toBe('whatever-the-line-said')
  })
})
