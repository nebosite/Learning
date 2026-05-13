export type Amount = number

/** ISO 8601 date string (YYYY-MM-DD). */
export type IsoDate = string

/** Parsed columns of a Monarch Money transaction row, mirroring the export header. */
export interface OriginalTransaction {
  date: IsoDate
  merchant: string
  category: string
  account: string
  originalStatement: string
  notes: string
  amount: Amount
  tags: string
  owner: string
}

/** User-supplied overrides. A missing key means "use the original value". */
export type TransactionOverrides = Partial<OriginalTransaction>

/**
 * One row in the master file.
 *
 * `key` is the verbatim TSV line text from the source file and serves as the
 * dedup identity — re-importing the same export produces identical keys.
 *
 * `ignored` is set once: transfer detection runs on freshly-imported records
 * only, never re-evaluates existing records, and the user can toggle it
 * freely after that.
 */
export interface TransactionRecord {
  key: string
  original: OriginalTransaction
  overrides: TransactionOverrides
  ignored: boolean
}

/** Persisted shape of the master file. Versioned so schema changes can be migrated. */
export interface MasterFile {
  version: 1
  records: TransactionRecord[]
}

/** A row that could not be parsed from a TSV import. */
export interface ParseError {
  /** 1-based line number in the source text, matching what an editor would show. */
  lineNumber: number
  raw: string
  reason: string
}

/** Outcome of a single TSV import, returned to the renderer for UI feedback. */
export interface ImportResult {
  master: MasterFile
  added: number
  skipped: number
  autoIgnored: number
  parseErrors: ParseError[]
}

export interface ElectronApi {
  /**
   * Open a file picker for a Monarch TSV export and import it.
   * Returns the import result, or null if the user cancelled the dialog.
   */
  importTsv: () => Promise<ImportResult | null>
  /** Read the current master file (returns an empty one on first run). */
  loadMaster: () => Promise<MasterFile>
  /** Persist the renderer's current set of records (overrides + ignored flags included). */
  saveMaster: (records: TransactionRecord[]) => Promise<void>
}

declare global {
  interface Window {
    api: ElectronApi
  }
}
