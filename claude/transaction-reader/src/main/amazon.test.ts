import { describe, expect, it } from 'vitest'
import { looksLikeAmazonCsv, parseAmazonCsv } from './amazon'

const HEADER =
  'order id,order url,items,to,date,total,shipping,shipping_refund,gift,tax,refund,payments'

describe('looksLikeAmazonCsv', () => {
  it('recognises a real Amazon History Reporter header', () => {
    expect(looksLikeAmazonCsv(HEADER)).toBe(true)
  })

  it('rejects a Monarch header', () => {
    expect(
      looksLikeAmazonCsv(
        'Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags,Owner',
      ),
    ).toBe(false)
  })
})

describe('parseAmazonCsv', () => {
  it('maps a basic order into the Monarch-shaped record we use internally', () => {
    const row =
      `114-1,https://example/o/1,"GiftExpress 24-Pack",Miss Janet,2026-05-07,27.26,0,,,2.27,,Prime Visa`
    const { rows, errors } = parseAmazonCsv([HEADER, row].join('\n'))

    expect(errors).toEqual([])
    expect(rows).toHaveLength(1)
    expect(rows[0].parsed).toEqual({
      date: '2026-05-07',
      merchant: 'NA',
      category: '',
      account: 'Amazon',
      originalStatement: 'GiftExpress 24-Pack',
      notes: '',
      amount: -27.26,
      tags: '',
      owner: '',
    })
    expect(rows[0].raw).toBe(row)
  })

  it('applies the refund - gift - total formula', () => {
    // total=60.10, gift=25.00, refund=5.00 => amount = 5 - 25 - 60.10 = -80.10
    const row =
      `114-2,https://example/o/2,Wreath,Miss Janet,2026-05-06,60.10,0,,25.00,7.11,5.00,Prime Visa`
    const { rows } = parseAmazonCsv([HEADER, row].join('\n'))
    expect(rows[0].parsed.amount).toBeCloseTo(-80.1, 2)
  })

  it('treats blank gift / refund cells as zero', () => {
    const row =
      `114-3,https://example/o/3,Soap,Miss Janet,2026-05-01,12.50,0,,,1.00,,Prime Visa`
    const { rows } = parseAmazonCsv([HEADER, row].join('\n'))
    expect(rows[0].parsed.amount).toBeCloseTo(-12.5, 2)
  })

  it('passes the items field through as the originalStatement', () => {
    const items = 'Thing A; Thing B; '
    const row =
      `114-4,https://example/o/4,"${items}",Miss Janet,2026-05-01,9.99,0,,,0.50,,Prime Visa`
    const { rows } = parseAmazonCsv([HEADER, row].join('\n'))
    expect(rows[0].parsed.originalStatement).toBe(items)
  })

  it('collects per-row errors for malformed dates', () => {
    const text = [
      HEADER,
      `114-5,https://example/o/5,X,Janet,not-a-date,1.00,0,,,0,,Prime`,
      `114-6,https://example/o/6,Y,Janet,2026-05-01,1.00,0,,,0,,Prime`,
    ].join('\n')
    const { rows, errors } = parseAmazonCsv(text)
    expect(rows).toHaveLength(1)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/date/i)
  })

  it('throws when a required column is missing', () => {
    expect(() =>
      parseAmazonCsv(['order id,items,date,total', '1,X,2026-05-01,1.00'].join('\n')),
    ).toThrow(/missing/i)
  })

  it('throws on an empty file', () => {
    expect(() => parseAmazonCsv('')).toThrow()
  })
})
