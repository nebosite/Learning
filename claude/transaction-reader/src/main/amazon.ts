import type { OriginalTransaction, ParseError } from '../shared/types'
import {
  parseFlexibleDate,
  parseNumericCell,
  tokenizeCsvLine,
} from './csv-format'
import type { ParsedRow, ParseResult } from './csv-format'

/**
 * Headers we need from an Amazon History Reporter export. Comparison is
 * case-insensitive against the trimmed header values.
 */
const REQUIRED_HEADERS = ['date', 'items', 'total', 'refund', 'gift'] as const

/** Whether the given CSV header line looks like an Amazon History Reporter export. */
export function looksLikeAmazonCsv(headerLine: string): boolean {
  const headers = new Set(
    tokenizeCsvLine(headerLine).map((h) => h.trim().toLowerCase()),
  )
  return REQUIRED_HEADERS.every((h) => headers.has(h))
}

/**
 * Parse a CSV produced by the "Amazon History Reporter" Chrome extension and
 * convert each row into the Monarch-shaped OriginalTransaction we use
 * internally. Per the agreed column rules:
 *
 *   merchant            = "unknown"
 *   category            = "unknown"
 *   account             = "amazon"
 *   originalStatement   = items
 *   notes / tags / owner = ""
 *   amount              = refund - gift - total
 *
 * Whole-file problems (empty file, missing required column) throw; per-row
 * problems (unparseable date) are collected so import can continue.
 */
export function parseAmazonCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || lines[0].trim() === '') {
    throw new Error('Amazon CSV file is empty.')
  }

  const headerFields = tokenizeCsvLine(lines[0])
  const headerIndex = new Map<string, number>()
  for (let i = 0; i < headerFields.length; i++) {
    headerIndex.set(headerFields[i].trim().toLowerCase(), i)
  }

  const missing = REQUIRED_HEADERS.filter((h) => !headerIndex.has(h))
  if (missing.length > 0) {
    throw new Error(
      `Amazon CSV is missing expected column(s): ${missing.join(', ')}.`,
    )
  }

  const col = (h: (typeof REQUIRED_HEADERS)[number]): number => headerIndex.get(h)!

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
      const dateRaw = fields[col('date')] ?? ''
      const date = parseFlexibleDate(dateRaw)
      if (date === null) {
        throw new Error(`Could not parse date "${dateRaw}".`)
      }

      // Blank numeric cells are treated as zero in the amount formula.
      const total = parseNumericCell(fields[col('total')] ?? '') ?? 0
      const gift = parseNumericCell(fields[col('gift')] ?? '') ?? 0
      const refund = parseNumericCell(fields[col('refund')] ?? '') ?? 0
      const amount = refund - gift - total

      const items = fields[col('items')] ?? ''

      const parsed: OriginalTransaction = {
        date,
        merchant: 'NA',
        category: '',
        account: 'Amazon',
        originalStatement: items,
        notes: '',
        amount,
        tags: '',
        owner: '',
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
