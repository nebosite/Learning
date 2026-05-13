import { describe, expect, it } from 'vitest'
import { mergeIntoMaster } from './merge'
import type { ParsedRow } from './tsv'
import type {
  MasterFile,
  OriginalTransaction,
  TransactionRecord,
  TransactionOverrides,
} from '../shared/types'

function row(raw: string, partial: Partial<OriginalTransaction> = {}): ParsedRow {
  return {
    raw,
    parsed: {
      date: '2026-05-08',
      merchant: 'X',
      category: '',
      account: 'A',
      originalStatement: '',
      notes: '',
      amount: -1,
      tags: '',
      owner: '',
      ...partial,
    },
  }
}

function existing(
  key: string,
  originalPartial: Partial<OriginalTransaction> = {},
  overrides: TransactionOverrides = {},
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
      ...originalPartial,
    },
    overrides,
    ignored: false,
  }
}

const emptyMaster: MasterFile = { version: 1, records: [] }

describe('mergeIntoMaster', () => {
  it('adds all rows when the master is empty', () => {
    const r = mergeIntoMaster(emptyMaster, [row('A'), row('B')])
    expect(r.added).toHaveLength(2)
    expect(r.skipped).toEqual([])
    expect(r.master.records).toHaveLength(2)
  })

  it('preserves within-batch duplicates as separate records', () => {
    const r = mergeIntoMaster(emptyMaster, [row('A'), row('A')])
    expect(r.added).toHaveLength(2)
    expect(r.skipped).toEqual([])
  })

  it('is idempotent when re-importing the same batch', () => {
    const first = mergeIntoMaster(emptyMaster, [row('A'), row('A'), row('B')])
    const second = mergeIntoMaster(first.master, [row('A'), row('A'), row('B')])
    expect(second.added).toEqual([])
    expect(second.skipped).toHaveLength(3)
    expect(second.master.records).toHaveLength(3)
  })

  it('count-matches: skips up to N existing, adds the rest', () => {
    const master: MasterFile = { version: 1, records: [existing('A')] }
    const r = mergeIntoMaster(master, [row('A'), row('A')])
    expect(r.added).toHaveLength(1)
    expect(r.skipped).toHaveLength(1)
  })

  it('sorts records by effective date descending', () => {
    const r = mergeIntoMaster(emptyMaster, [
      row('a', { date: '2026-05-07' }),
      row('b', { date: '2026-05-09' }),
      row('c', { date: '2026-05-08' }),
    ])
    expect(r.master.records.map((rec) => rec.key)).toEqual(['b', 'c', 'a'])
  })

  it('uses the override date for sorting when one exists', () => {
    const master: MasterFile = {
      version: 1,
      records: [
        existing('a', { date: '2026-05-01' }, { date: '2026-05-09' }),
        existing('b', { date: '2026-05-05' }),
      ],
    }
    const r = mergeIntoMaster(master, [])
    expect(r.master.records.map((rec) => rec.key)).toEqual(['a', 'b'])
  })

  it('does not mutate the input master', () => {
    const master: MasterFile = { version: 1, records: [existing('A')] }
    const before = JSON.parse(JSON.stringify(master))
    mergeIntoMaster(master, [row('B'), row('C')])
    expect(master).toEqual(before)
  })

  it('preserves master.version in the result', () => {
    const r = mergeIntoMaster({ version: 1, records: [] }, [])
    expect(r.master.version).toBe(1)
  })
})
