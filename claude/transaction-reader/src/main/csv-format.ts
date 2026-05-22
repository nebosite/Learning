import type { IsoDate, OriginalTransaction, ParseError } from '../shared/types'

/** One successfully-parsed row from a CSV import. */
export interface ParsedRow {
  /** The verbatim source line — used as the dedup key. */
  raw: string
  parsed: OriginalTransaction
}

export interface ParseResult {
  rows: ParsedRow[]
  errors: ParseError[]
}

/**
 * Tokenize one CSV line into fields (RFC 4180). A field that starts with `"`
 * is quoted: it ends at the next unescaped `"`, and `""` inside a quoted
 * field represents a literal `"`. Unquoted fields end at the next comma.
 */
export function tokenizeCsvLine(line: string): string[] {
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

/**
 * Parse a date in either YYYY-MM-DD (Monarch's export and Amazon's export) or
 * M/D/YYYY (US slash style for hand-edited files) and return canonical ISO.
 */
export function parseFlexibleDate(s: string): IsoDate | null {
  const t = s.trim()
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const slash = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const month = slash[1].padStart(2, '0')
    const day = slash[2].padStart(2, '0')
    return `${slash[3]}-${month}-${day}`
  }
  return null
}

/**
 * Parse a numeric CSV cell. Thousands-separator commas are stripped (quoted
 * cells like "1,234.56" arrive here with the comma after tokenization).
 * Blank or unparseable input returns `null`.
 */
export function parseNumericCell(s: string): number | null {
  const trimmed = s.trim().replace(/,/g, '')
  if (trimmed === '') return null
  const n = Number(trimmed)
  if (Number.isNaN(n)) return null
  return n
}
