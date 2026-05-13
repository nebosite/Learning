import type { IsoDate, OriginalTransaction } from '../shared/types'

export interface ParsedRow {
  raw: string
  parsed: OriginalTransaction
}

export interface ParseError {
  /** 1-based line number in the source text, matching what an editor would show. */
  lineNumber: number
  raw: string
  reason: string
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: ParseError[]
}

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

/**
 * Parse the text of a Monarch Money TSV export.
 *
 * Throws if the file is empty or any required column is missing in the header
 * (those are whole-file problems, not per-row). Per-row problems (unparseable
 * date or amount) are collected as `errors` so import can continue.
 */
export function parseMonarchTsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/)
  if (lines.length === 0 || lines[0].trim() === '') {
    throw new Error('TSV file is empty.')
  }

  const headerFields = tokenize(lines[0])
  const headerIndex = new Map<string, number>()
  for (let i = 0; i < headerFields.length; i++) {
    headerIndex.set(headerFields[i], i)
  }

  const missing = REQUIRED_HEADERS.filter((h) => !headerIndex.has(h))
  if (missing.length > 0) {
    throw new Error(`TSV is missing expected column(s): ${missing.join(', ')}.`)
  }

  const col = (h: RequiredHeader): number => headerIndex.get(h)!

  const rows: ParsedRow[] = []
  const errors: ParseError[] = []

  for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
    const raw = lines[lineIdx]
    if (raw.trim() === '') continue
    const lineNumber = lineIdx + 1

    try {
      const fields = tokenize(raw)
      const dateRaw = fields[col('Date')] ?? ''
      const amountRaw = fields[col('Amount')] ?? ''

      const date = parseDate(dateRaw)
      if (date === null) {
        throw new Error(`Could not parse date "${dateRaw}".`)
      }

      const amount = parseAmount(amountRaw)
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

/**
 * Tokenize one TSV line into fields. A field that starts with `"` is treated
 * as quoted: it ends at the next unescaped `"`, and `""` inside a quoted
 * field represents a literal `"` (RFC 4180 convention).
 */
function tokenize(line: string): string[] {
  const fields: string[] = []
  let i = 0
  while (i <= line.length) {
    let field = ''
    if (i < line.length && line[i] === '"') {
      i++
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            field += '"'
            i += 2
          } else {
            i++
            break
          }
        } else {
          field += line[i]
          i++
        }
      }
      while (i < line.length && line[i] !== '\t') i++
    } else {
      while (i < line.length && line[i] !== '\t') {
        field += line[i]
        i++
      }
    }
    fields.push(field)
    if (i < line.length && line[i] === '\t') {
      i++
    } else {
      break
    }
  }
  return fields
}

function parseDate(s: string): IsoDate | null {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return null
  const month = m[1].padStart(2, '0')
  const day = m[2].padStart(2, '0')
  const year = m[3]
  return `${year}-${month}-${day}`
}

function parseAmount(s: string): number | null {
  const trimmed = s.trim()
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (Number.isNaN(n)) return null
  return n
}
