import { describe, it, expect } from 'vitest'
import { parseMonarchCsv } from './csv'

const HEADER =
  'Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags,Owner'

describe('parseMonarchCsv', () => {
  it('parses a basic row from a representative Monarch line', () => {
    const row = '5/8/2026,Netflix,subscriptions,Janet Chase (...6171),NETFLIX.COM,,-29.82,,Shared'
    const { rows, errors } = parseMonarchCsv([HEADER, row].join('\n'))

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
    const row = `5/6/2026,Ryan Roberts,Personal,Venmo (Eric),"Ryan Roberts ""said hi""",,-140,,Shared`
    const { rows, errors } = parseMonarchCsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows[0].parsed.originalStatement).toBe('Ryan Roberts "said hi"')
    expect(rows[0].parsed.amount).toBe(-140)
  })

  it('parses dates in ISO (YYYY-MM-DD) format, as Monarch exports them', () => {
    const row =
      "2026-05-07,McDonald's,Restaurants & Bars,Discover More Card (...7306),McDonalds #17875,,-8.83,,Shared"
    const { rows, errors } = parseMonarchCsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows[0].parsed.date).toBe('2026-05-07')
    expect(rows[0].parsed.amount).toBe(-8.83)
  })

  it('parses quoted fields containing commas', () => {
    const row = `5/8/2026,"Joe's Cafe, Inc.",food,A,STMT,,-12.50,,Shared`
    const { rows, errors } = parseMonarchCsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows[0].parsed.merchant).toBe("Joe's Cafe, Inc.")
  })

  it('parses amounts with thousands-separator commas', () => {
    const row = `5/8/2026,Big purchase,misc,A,STMT,,"-1,234.56",,Shared`
    const { rows, errors } = parseMonarchCsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows[0].parsed.amount).toBe(-1234.56)
  })

  it('handles CRLF line endings', () => {
    const text = [HEADER, '5/8/2026,A,B,C,D,,-1,,S'].join('\r\n')
    const { rows, errors } = parseMonarchCsv(text)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
  })

  it('skips blank, whitespace-only, and 1-character lines', () => {
    const text = [
      HEADER,
      '',
      '5/8/2026,A,B,C,D,,-1,,S',
      '   ',
      ',', // a stray comma some exporters leave at the end
      '5/9/2026,A,B,C,D,,-2,,S',
    ].join('\n')
    const { rows, errors } = parseMonarchCsv(text)
    expect(errors).toEqual([])
    expect(rows).toHaveLength(2)
  })

  it('collects errors for malformed dates without aborting', () => {
    const text = [
      HEADER,
      'bogus-date,A,B,C,D,,-1,,S',
      '5/8/2026,A,B,C,D,,-2,,S',
    ].join('\n')
    const { rows, errors } = parseMonarchCsv(text)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].lineNumber).toBe(2)
    expect(errors[0].reason).toMatch(/date/i)
  })

  it('collects errors for malformed amounts', () => {
    const text = [HEADER, '5/8/2026,A,B,C,D,,not-a-number,,S'].join('\n')
    const { rows, errors } = parseMonarchCsv(text)
    expect(rows).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/amount/i)
  })

  it('throws when a required header is missing', () => {
    expect(() =>
      parseMonarchCsv(['Date,Merchant', '5/8/2026,Netflix'].join('\n')),
    ).toThrow(/missing/i)
  })

  it('throws on an empty file', () => {
    expect(() => parseMonarchCsv('')).toThrow()
  })

  it('preserves the verbatim raw line for use as the dedup key', () => {
    const row = '5/8/2026,Netflix,subs,A,NETFLIX,,-1,,S'
    const { rows } = parseMonarchCsv([HEADER, row].join('\n'))
    expect(rows[0].raw).toBe(row)
  })
})
