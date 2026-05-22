import type { OriginalTransaction, ParseError } from '../shared/types'
import {
  parseFlexibleDate,
  parseNumericCell,
  tokenizeCsvLine,
} from './csv-format'
import type { ParsedRow, ParseResult } from './csv-format'

export type { ParseError, ParsedRow, ParseResult }

const REQUIRED_HEADERS = [
  'Date',
  'Merchant',
  'Category',
  'Account',
  'Original Statement',
  'Notes',
  'Amount',
  'Tags',
  'Owner',
] as const

type RequiredHeader = (typeof REQUIRED_HEADERS)[number]

/** Whether the given CSV header line looks like a Monarch Money export. */
export function looksLikeMonarchCsv(headerLine: string): boolean {
  const headers = new Set(tokenizeCsvLine(headerLine).map((h) => h.trim()))
  return REQUIRED_HEADERS.every((h) => headers.has(h))
}

/**
 * Parse the text of a Monarch Money CSV export.
 *
 * Throws if the file is empty or any required column is missing in the header
 * (those are whole-file problems, not per-row). Per-row problems (unparseable
 * date or amount) are collected as `errors` so import can continue.
 */
export function parseMonarchCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || lines[0].trim() === '') {
    throw new Error('CSV file is empty.')
  }

  const headerFields = tokenizeCsvLine(lines[0])
  const headerIndex = new Map<string, number>()
  for (let i = 0; i < headerFields.length; i++) {
    headerIndex.set(headerFields[i], i)
  }

  const missing = REQUIRED_HEADERS.filter((h) => !headerIndex.has(h))
  if (missing.length > 0) {
    throw new Error(`CSV is missing expected column(s): ${missing.join(', ')}.`)
  }

  const col = (h: RequiredHeader): number => headerIndex.get(h)!

  const rows: ParsedRow[] = []
  const errors: ParseError[] = []

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const raw = lines[lineIdx]
    // Skip anything too short to be a real row: blank, whitespace, or a stray
    // single character (some exporters end the file with a lone comma).
    if (raw.trim().length < 2) continue
    const lineNumber = lineIdx + 1

    try {
      const fields = tokenizeCsvLine(raw)
      const dateRaw = fields[col('Date')] ?? ''
      const amountRaw = fields[col('Amount')] ?? ''

      const date = parseFlexibleDate(dateRaw)
      if (date === null) {
        throw new Error(`Could not parse date "${dateRaw}".`)
      }

      const amount = parseNumericCell(amountRaw)
      if (amount === null) {
        throw new Error(`Could not parse amount "${amountRaw}".`)
      }

      const parsed: OriginalTransaction = {
        date,
        merchant: fields[col('Merchant')] ?? '',
        category: fields[col('Category')] ?? '',
        account: fields[col('Account')] ?? '',
        originalStatement: fields[col('Original Statement')] ?? '',
        notes: fields[col('Notes')] ?? '',
        amount,
        tags: fields[col('Tags')] ?? '',
        owner: fields[col('Owner')] ?? '',
      }
      rows.push({ raw, parsed })
    } catch (e) {
      errors.push({
        lineNumber,
        raw,
        reason: e instanceof Error ? e.message : String(e),
      })
    }
  }

  return { rows, errors }
}
