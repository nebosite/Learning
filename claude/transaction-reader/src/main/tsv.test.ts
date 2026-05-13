import { describe, it, expect } from 'vitest'
import { parseMonarchTsv } from './tsv'

const HEADER =
  'Date\tMerchant\tCategory\tAccount\tOriginal Statement\tNotes\tAmount\tTags\tOwner'

describe('parseMonarchTsv', () => {
  it('parses a basic row from a representative Monarch line', () => {
    const row =
      '5/8/2026\tNetflix\tsubscriptions\tJanet Chase (...6171)\tNETFLIX.COM\t\t-29.82\t\tShared'
    const { rows, errors } = parseMonarchTsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].parsed).toEqual({
      date: '2026-05-08',
      merchant: 'Netflix',
      category: 'subscriptions',
      account: 'Janet Chase (...6171)',
      originalStatement: 'NETFLIX.COM',
      notes: '',
      amount: -29.82,
      tags: '',
      owner: 'Shared',
    })
    expect(rows[0].raw).toBe(row)
  })

  it('parses quoted fields with embedded doubled quotes', () => {
    const row = `5/6/2026\tRyan Roberts\tPersonal\tVenmo (Eric)\t"Ryan Roberts ""said hi"""\t\t-140\t\tShared`
    const { rows, errors } = parseMonarchTsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows[0].parsed.originalStatement).toBe('Ryan Roberts "said hi"')
    expect(rows[0].parsed.amount).toBe(-140)
  })

  it('handles CRLF line endings', () => {
    const text = [HEADER, '5/8/2026\tA\tB\tC\tD\t\t-1\t\tS'].join('\r\n')
    const { rows, errors } = parseMonarchTsv(text)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
  })

  it('skips blank and whitespace-only lines', () => {
    const text = [
      HEADER,
      '',
      '5/8/2026\tA\tB\tC\tD\t\t-1\t\tS',
      '   ',
      '5/9/2026\tA\tB\tC\tD\t\t-2\t\tS',
    ].join('\n')
    const { rows, errors } = parseMonarchTsv(text)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
  })

  it('collects errors for malformed dates without aborting', () => {
    const text = [
      HEADER,
      'bogus-date\tA\tB\tC\tD\t\t-1\t\tS',
      '5/8/2026\tA\tB\tC\tD\t\t-2\t\tS',
    ].join('\n')
    const { rows, errors } = parseMonarchTsv(text)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].lineNumber).toBe(2)
    expect(errors[0].reason).toMatch(/date/i)
  })

  it('collects errors for malformed amounts', () => {
    const text = [HEADER, '5/8/2026\tA\tB\tC\tD\t\tnot-a-number\t\tS'].join('\n')
    const { rows, errors } = parseMonarchTsv(text)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/amount/i)
  })

  it('throws when a required header is missing', () => {
    expect(() =>
      parseMonarchTsv(['Date\tMerchant', '5/8/2026\tNetflix'].join('\n')),
    ).toThrow(/missing/i)
  })

  it('throws on an empty file', () => {
    expect(() => parseMonarchTsv('')).toThrow()
  })

  it('preserves the verbatim raw line for use as the dedup key', () => {
    const row = '5/8/2026\tNetflix\tsubs\tA\tNETFLIX\t\t-1\t\tS'
    const { rows } = parseMonarchTsv([HEADER, row].join('\n'))
    expect(rows[0].raw).toBe(row)
  })
})
