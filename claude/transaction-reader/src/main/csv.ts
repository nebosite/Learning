import type { IsoDate, OriginalTransaction, ParseError } from '../shared/types'

export type { ParseError }

export interface ParsedRow {
  raw: string
  parsed: OriginalTransaction
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

  const headerFields = tokenize(lines[0])
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
 * Tokenize one CSV line into fields (RFC 4180). A field that starts with `"`
 * is quoted: it ends at the next unescaped `"`, and `""` inside a quoted
 * field represents a literal `"`. Unquoted fields end at the next comma.
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
      while (i < line.length && line[i] !== ',') i++
    } else {
      while (i < line.length && line[i] !== ',') {
        field += line[i]
        i++
      }
    }
    fields.push(field)
    if (i < line.length && line[i] === ',') {
      i++
    } else {
      break
    }
  }
  return fields
}

function parseDate(s: string): IsoDate | null {
  const t = s.trim()
  // YYYY-MM-DD — the format Monarch's CSV export actually uses.
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  // M/D/YYYY — kept for hand-edited files and older exports.
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const month = slash[1].padStart(2, '0')
    const day = slash[2].padStart(2, '0')
    return `${slash[3]}-${month}-${day}`
  }
  return null
}

function parseAmount(s: string): number | null {
  // Strip thousands-separator commas; a quoted CSV cell like "1,234.56" loses
  // its quotes during tokenization and still arrives here with the comma.
  const trimmed = s.trim().replace(/,/g, '')
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (Number.isNaN(n)) return null
  return n
}
